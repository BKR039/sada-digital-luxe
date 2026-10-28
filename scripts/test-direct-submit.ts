import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || '').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

import { submitSmartContactLead } from '../src/lib/smart-match-service';

async function run() {
  const payload = {
    lead: {
      fullName: 'Boubakar QA Lead',
      businessName: 'Le Gourmet Luxury Diner',
      phone: '+216 98 123 456',
      email: `test.submit.direct.${Date.now()}@sada.media`
    },
    qualification: {
      businessType: 'Restaurant / Café',
      businessStage: 'operating_growth',
      primaryGoals: ['Grow social media presence'],
      requiredServices: ['Content + Ads'],
      contentIntensity: 'high_growth',
      advertisingNeed: 'yes_monthly',
      budgetRange: '2000_plus'
    },
    recommendation: {
      packageId: 'hy-03-scale-produce',
      packageCode: 'HY-03',
      packageName: 'Scale Produce',
      score: 95,
      matchLevel: 'strong' as const,
      alternativePackageIds: [],
      reasons: ['Directly aligned'],
      isUnpublished: false
    },
    source: 'quick_match' as const
  };

  console.log('Invoking submitSmartContactLead with payload...');
  const res = await submitSmartContactLead(payload as any);
  console.log('submitSmartContactLead RESULT:', res);
}

run().catch(console.error);
