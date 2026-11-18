// Additive generation preserves the existing published transport and exports.
// Usage: node scripts/generate-paid-membership-client.cjs <Rails Swagger JSON> <client checkout>
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const client = path.resolve(process.argv[3]);
const schemas = spec.components.schemas;
function type(schema) {
  if (schema.$ref) return schema.$ref.split('/').pop();
  if (schema.type === 'object') return `{ ${Object.entries(schema.properties).map(([key, value]) =>
    `${JSON.stringify(key)}${schema.required.includes(key) ? '' : '?'}: ${type(value)};`).join(' ')} }`;
  const result = { integer: 'number', string: 'string', boolean: 'boolean' }[schema.type];
  assert.ok(result, `Unsupported contract type ${schema.type}`); return result;
}
const operations = [
  ['/members/{id}/continuous_paid_membership', 'get', 'getContinuousPaidMembership'],
  ['/admin/members/{id}/continuous_paid_membership', 'put', 'increaseContinuousPaidMembership'],
];
let output = "// Generated from Rails OpenAPI by scripts/generate-paid-membership-client.cjs.\n" +
  "import { makeRequest, ApiDataResponse } from './apiClient';\n\n";
for (const name of ['ContinuousPaidMembership', 'IncreaseContinuousPaidMembership'])
  output += `export type ${name} = ${type(schemas[name])};\n`;
for (const [route, method, operationId] of operations) {
  assert.equal(spec.paths[route][method].operationId, operationId);
  const body = method === 'put';
  output += `\nexport function ${operationId}(params: { id: string; ${body ? 'body: IncreaseContinuousPaidMembership;' : ''} }): Promise<ApiDataResponse<ContinuousPaidMembership>> {\n` +
    `  return makeRequest<ContinuousPaidMembership>(${JSON.stringify(method.toUpperCase())}, ${JSON.stringify(route)}.replace('{id}', encodeURIComponent(params.id)), ${body ? 'params.body' : 'undefined'});\n}\n`;
}
fs.writeFileSync(path.join(client, 'lib/paidMembership.ts'), output);
const mainPath = path.join(client, 'lib/apiClient.ts');
let main = fs.readFileSync(mainPath, 'utf8');
if (!main.includes("export * from './paidMembership';")) {
  main += "\nexport * from './paidMembership';\n";
  fs.writeFileSync(mainPath, main);
}
console.log('Generated paid membership contracts and operations from Rails Swagger');
