import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const typesPath = path.resolve(process.cwd(), 'src/integrations/supabase/types.ts');
const sourceFile = ts.createSourceFile(
  'types.ts',
  fs.readFileSync(typesPath, 'utf-8'),
  ts.ScriptTarget.Latest,
  true
);

interface TableInfo {
  name: string;
  columns: Record<string, { type: string; nullable: boolean }>;
  relationships: Array<{
    foreignKeyName: string;
    columns: string[];
    referencedRelation: string;
    referencedColumns: string[];
  }>;
}

interface FunctionInfo {
  name: string;
  args: Record<string, string>;
  returns: string;
}

const tables: Record<string, TableInfo> = {};
const functions: Record<string, FunctionInfo> = {};
const enums: Record<string, string[]> = {};

function visit(node: ts.Node) {
  if (ts.isTypeAliasDeclaration(node) && node.name.text === 'Database') {
    // Traverse Database type
    ts.forEachChild(node.type, (member) => {
      if (ts.isPropertySignature(member) && member.name.getText(sourceFile) === 'public') {
        const publicType = member.type;
        if (publicType && ts.isTypeLiteralNode(publicType)) {
          publicType.members.forEach((pubMember) => {
            if (ts.isPropertySignature(pubMember)) {
              const secName = pubMember.name.getText(sourceFile);
              if (secName === 'Tables' && pubMember.type && ts.isTypeLiteralNode(pubMember.type)) {
                // Parse tables
                pubMember.type.members.forEach((tblMember) => {
                  if (ts.isPropertySignature(tblMember)) {
                    const tblName = tblMember.name.getText(sourceFile);
                    const tblType = tblMember.type;
                    if (tblType && ts.isTypeLiteralNode(tblType)) {
                      const colMap: Record<string, { type: string; nullable: boolean }> = {};
                      let rels: any[] = [];
                      tblType.members.forEach((part) => {
                        if (ts.isPropertySignature(part)) {
                          const partName = part.name.getText(sourceFile);
                          if (partName === 'Row' && part.type && ts.isTypeLiteralNode(part.type)) {
                            part.type.members.forEach((colProp) => {
                              if (ts.isPropertySignature(colProp)) {
                                const cName = colProp.name.getText(sourceFile);
                                const cType = colProp.type ? colProp.type.getText(sourceFile) : 'any';
                                colMap[cName] = {
                                  type: cType,
                                  nullable: cType.includes('null')
                                };
                              }
                            });
                          }
                        }
                      });
                      tables[tblName] = {
                        name: tblName,
                        columns: colMap,
                        relationships: rels
                      };
                    }
                  }
                });
              } else if (secName === 'Functions' && pubMember.type && ts.isTypeLiteralNode(pubMember.type)) {
                pubMember.type.members.forEach((fnMember) => {
                  if (ts.isPropertySignature(fnMember)) {
                    const fnName = fnMember.name.getText(sourceFile);
                    const fnType = fnMember.type;
                    if (fnType && ts.isTypeLiteralNode(fnType)) {
                      const args: Record<string, string> = {};
                      let returns = 'unknown';
                      fnType.members.forEach((fPart) => {
                        if (ts.isPropertySignature(fPart)) {
                          const pName = fPart.name.getText(sourceFile);
                          if (pName === 'Args' && fPart.type && ts.isTypeLiteralNode(fPart.type)) {
                            fPart.type.members.forEach((aProp) => {
                              if (ts.isPropertySignature(aProp)) {
                                args[aProp.name.getText(sourceFile)] = aProp.type ? aProp.type.getText(sourceFile) : 'any';
                              }
                            });
                          } else if (pName === 'Returns') {
                            returns = fPart.type ? fPart.type.getText(sourceFile) : 'void';
                          }
                        }
                      });
                      functions[fnName] = { name: fnName, args, returns };
                    }
                  }
                });
              } else if (secName === 'Enums' && pubMember.type && ts.isTypeLiteralNode(pubMember.type)) {
                pubMember.type.members.forEach((enMember) => {
                  if (ts.isPropertySignature(enMember)) {
                    const enName = enMember.name.getText(sourceFile);
                    const enType = enMember.type ? enMember.type.getText(sourceFile) : '';
                    enums[enName] = enType.split('|').map(s => s.trim().replace(/^["']|["']$/g, ''));
                  }
                });
              }
            }
          });
        }
      }
    });
  }
  ts.forEachChild(node, visit);
}

visit(sourceFile);

console.log('TypeScript AST Extracted:');
console.log('Total Tables in types.ts:', Object.keys(tables).length);
console.log('Total Functions in types.ts:', Object.keys(functions).length);
console.log('Total Enums in types.ts:', Object.keys(enums).length);
console.log('Table sample:', Object.keys(tables).slice(0, 10));

fs.writeFileSync(
  path.resolve(process.cwd(), 'scripts/ts_ast_extracted_types.json'),
  JSON.stringify({ tables, functions, enums }, null, 2)
);
