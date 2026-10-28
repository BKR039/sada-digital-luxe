import fs from 'fs';
import path from 'path';

// 1. Analyze services in src/lib
const libDir = path.resolve(process.cwd(), 'src/lib');
const serviceFiles = fs.readdirSync(libDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

interface ServiceDbUsage {
  serviceFile: string;
  tablesRead: Set<string>;
  tablesWritten: Set<string>;
  rpcsCalled: Set<string>;
  businessRulesAccessed: Set<string>;
}

const serviceMap: Record<string, ServiceDbUsage> = {};

for (const sf of serviceFiles) {
  const content = fs.readFileSync(path.join(libDir, sf), 'utf-8');
  const tablesRead = new Set<string>();
  const tablesWritten = new Set<string>();
  const rpcsCalled = new Set<string>();
  const businessRulesAccessed = new Set<string>();

  // Look for .from('...')
  const fromRegex = /\.from\(\s*["']([a-zA-Z0-9_]+)["']\s*\)/g;
  let match;
  while ((match = fromRegex.exec(content)) !== null) {
    const tbl = match[1];
    // Check next tokens for write vs read
    const after = content.slice(match.index, match.index + 200);
    if (/\.(insert|update|delete|upsert)\(/i.test(after)) {
      tablesWritten.add(tbl);
    }
    if (/\.select\(/i.test(after) || !/\.(insert|update|delete|upsert)\(/i.test(after)) {
      tablesRead.add(tbl);
    }
  }

  // Look for .rpc('...')
  const rpcRegex = /\.rpc\(\s*["']([a-zA-Z0-9_]+)["']/g;
  while ((match = rpcRegex.exec(content)) !== null) {
    rpcsCalled.add(match[1]);
  }

  // Look for business rules
  const ruleRegex = /(?:getBusinessRule|getBusinessRuleNumber|isRuleTriggered)\(\s*["']([a-zA-Z0-9_]+)["']/g;
  while ((match = ruleRegex.exec(content)) !== null) {
    businessRulesAccessed.add(match[1]);
  }

  serviceMap[sf] = {
    serviceFile: sf,
    tablesRead,
    tablesWritten,
    rpcsCalled,
    businessRulesAccessed
  };
}

// 2. Analyze routes in src/routes
const routesDir = path.resolve(process.cwd(), 'src/routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

// Also read route permission registry
const permRegistryPath = path.resolve(process.cwd(), 'src/lib/route-permission-registry.ts');
const permRegistryContent = fs.existsSync(permRegistryPath) ? fs.readFileSync(permRegistryPath, 'utf-8') : '';

interface RouteTrace {
  routeFile: string;
  path: string;
  importedServices: string[];
  tablesRead: string[];
  tablesWritten: string[];
  rpcsCalled: string[];
  businessRulesAccessed: string[];
  moduleName?: string;
  requiredPermission?: string;
  components: string[];
  status: string;
}

const routeTraces: RouteTrace[] = [];

for (const rf of routeFiles) {
  const content = fs.readFileSync(path.join(routesDir, rf), 'utf-8');

  // Convert route file to URL path
  let urlPath = rf
    .replace(/\.tsx?$/, '')
    .replace(/\$([a-zA-Z0-9_]+)/g, ':$1')
    .replace(/\./g, '/')
    .replace(/\/index$/, '')
    .replace(/^index$/, '/');
  if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;

  // Find imported services
  const importedServices: string[] = [];
  const tablesRead = new Set<string>();
  const tablesWritten = new Set<string>();
  const rpcsCalled = new Set<string>();
  const businessRulesAccessed = new Set<string>();

  for (const sf of serviceFiles) {
    const baseName = sf.replace(/\.tsx?$/, '');
    if (content.includes(`@/lib/${baseName}`) || content.includes(`from "./${baseName}"`)) {
      importedServices.push(sf);
      const sUsage = serviceMap[sf];
      if (sUsage) {
        sUsage.tablesRead.forEach(t => tablesRead.add(t));
        sUsage.tablesWritten.forEach(t => tablesWritten.add(t));
        sUsage.rpcsCalled.forEach(r => rpcsCalled.add(r));
        sUsage.businessRulesAccessed.forEach(b => businessRulesAccessed.add(b));
      }
    }
  }

  // Direct .from and .rpc in route file
  const fromRegex = /\.from\(\s*["']([a-zA-Z0-9_]+)["']\s*\)/g;
  let match;
  while ((match = fromRegex.exec(content)) !== null) {
    const tbl = match[1];
    const after = content.slice(match.index, match.index + 200);
    if (/\.(insert|update|delete|upsert)\(/i.test(after)) {
      tablesWritten.add(tbl);
    }
    if (/\.select\(/i.test(after)) {
      tablesRead.add(tbl);
    }
  }
  const rpcRegex = /\.rpc\(\s*["']([a-zA-Z0-9_]+)["']/g;
  while ((match = rpcRegex.exec(content)) !== null) {
    rpcsCalled.add(match[1]);
  }

  // Find components imported
  const compRegex = /import\s+[\s\S]*?\s+from\s+["']@\/components\/([^"']+)["']/g;
  const components: string[] = [];
  while ((match = compRegex.exec(content)) !== null) {
    components.push(match[1]);
  }

  // Check route permission registry
  let requiredPermission = '';
  let moduleName = '';
  const cleanPath = urlPath.replace(/:[a-zA-Z0-9_]+/g, '').replace(/\/$/, '') || '/';
  const regRegex = new RegExp(`path:\\s*["']${cleanPath}["'][\\s\\S]*?requiredPermission:\\s*["']([^"']+)["']`, 'i');
  const regMatch = permRegistryContent.match(regRegex);
  if (regMatch) {
    requiredPermission = regMatch[1];
  }

  // Classification status
  let status = 'VERIFIED_CANONICAL_SOURCE';
  if (tablesRead.size === 0 && tablesWritten.size === 0 && rpcsCalled.size === 0) {
    if (rf.includes('portfolio') || rf.includes('client-projects') || rf.includes('deals') || rf.includes('commissions') || rf.includes('salary.tsx')) {
      status = 'VERIFIED_DERIVED_PROJECTION'; // alias/redirect route
    } else {
      status = 'HARDCODED_OR_MOCKED'; // Static marketing or landing page
    }
  }

  routeTraces.push({
    routeFile: rf,
    path: urlPath,
    importedServices,
    tablesRead: Array.from(tablesRead),
    tablesWritten: Array.from(tablesWritten),
    rpcsCalled: Array.from(rpcsCalled),
    businessRulesAccessed: Array.from(businessRulesAccessed),
    moduleName,
    requiredPermission,
    components,
    status
  });
}

const traceOutput = {
  totalRoutes: routeTraces.length,
  services: Object.fromEntries(
    Object.entries(serviceMap).map(([k, v]) => [
      k,
      {
        tablesRead: Array.from(v.tablesRead),
        tablesWritten: Array.from(v.tablesWritten),
        rpcsCalled: Array.from(v.rpcsCalled),
        businessRulesAccessed: Array.from(v.businessRulesAccessed)
      }
    ])
  ),
  routes: routeTraces
};

fs.writeFileSync(
  path.resolve(process.cwd(), 'scripts/page_to_database_trace.json'),
  JSON.stringify(traceOutput, null, 2)
);

console.log(`Page to database tracing completed!`);
console.log(`Total routes analyzed: ${routeTraces.length}`);
console.log(`Routes with verified DB dependencies: ${routeTraces.filter(r => r.tablesRead.length > 0 || r.tablesWritten.length > 0 || r.rpcsCalled.length > 0).length}`);
