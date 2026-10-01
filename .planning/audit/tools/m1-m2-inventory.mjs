/** Reviewed M1/M2 classifications, separate from the immutable Phase-1 baseline.
 * Run after classify-inventory.mjs; --write refreshes only these owned rows.
 * Baseline expectations explicitly run with all feature switches disabled.
 */
import fs from 'node:fs';
export const M1_M2_ENDPOINTS = {
 '/api/universities': ['anonymous', 200],
 '/api/discovery': ['anonymous', 404],
 '/api/opportunities/[id]': ['anonymous', 404],
 '/api/opportunities/[id]/save': ['authenticated', 404],
 '/api/saved': ['authenticated', 404],
 '/api/saved/status': ['authenticated', 404],
 '/api/admin/opportunities': ['admin', 200],
 '/api/admin/opportunities/[id]': ['admin', 404],
 '/api/admin/events/[id]/discovery': ['admin', 200],
 '/api/resources': ['anonymous', 404],
 '/api/resources/[slug]': ['anonymous', 404],
 '/api/resources/[slug]/open': ['anonymous', 404],
 '/api/admin/resources': ['admin', 200],
 '/api/admin/resources/[id]': ['admin', 404],
 '/api/admin/resources/[id]/file': ['admin', 404],
 '/api/submissions': ['anonymous', 404],
 '/api/company-requests': ['anonymous', 404],
 '/api/listing-reports': ['anonymous', 404],
 '/api/admin/submissions': ['admin', 200],
 '/api/admin/submissions/[id]': ['admin', 404],
 '/api/admin/listing-reports': ['admin', 200],
 '/api/admin/listing-reports/[id]': ['admin', 404],
 '/api/admin/ingestion': ['admin', 200],
 '/api/admin/ingestion/images': ['admin', 200],
};
export const M1_M2_PAGES = ['/discover', '/saved', '/opportunities/[id]', '/moderation/opportunities', '/resources', '/resources/[slug]', '/moderation/resources', '/submit', '/for-companies', '/moderation/submissions', '/moderation/ingestion'];
const personas = ['anonymous','onboarded_student','mid_onboarding_student','club_member','club_owner','multi_club_organizer','cross_club_attacker','admin','banned_permanent','suspended_active','suspension_expired','non_mcgill_signin','machine_no_credential'];
export function updateM1M2Inventory() {
 const base = '.planning/audit/inventory/';
 const endpoints = JSON.parse(fs.readFileSync(base+'endpoints.json','utf8'));
 for (const [route,[auth,status]] of Object.entries(M1_M2_ENDPOINTS)) {
  const file = 'src/app'+route+'/route.ts', src = fs.readFileSync(file,'utf8');
  const methods = [...src.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map(m=>m[1]);
  const id = route.slice(1).replace(/[\[\]]/g,'').replaceAll('/','.');
  const expected_status = Object.fromEntries(personas.map(who=>[who, who==='non_mcgill_signin' ? 'n/a' : ['banned_permanent','suspended_active'].includes(who) ? 403 : ['anonymous','machine_no_credential'].includes(who) && auth!=='anonymous' ? 401 : auth==='admin' && who!=='admin' ? 403 : status]));
  const row = { id,file,route,methods,dynamic_segments:[...route.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]),
   signals:{uses_cookie_client:auth!=='admin',uses_service_client:auth==='admin',calls_verify_admin:auth==='admin',calls_get_user:route!=='/api/universities',calls_get_session:false,calls_check_ban:auth!=='anonymous',inline_role_check:false,references_club_members:false,parses_body:/parseBody\(/.test(src),has_zod:/parse(?:Body|Query|With)\(/.test(src),sets_cache_control:true,cache_control_values:['private, no-store'],env_vars_referenced:[],env_gated_auth:false,has_try_catch:/catch\s*\(/.test(src),catch_any_count:0,console_count:0,as_any_count:0,tables_referenced:[...src.matchAll(/\.from\("([^"]+)"\)/g)].map(m=>m[1]),loc:src.split('\n').length},
   auth_requirement:auth,role_required:auth==='admin'?'adminContext: active user + requireRole(admin) before elevated access':null,rls_reliance:auth==='admin'?'bypassed':'primary',service_role_justified:auth==='admin'?'M2 editorial writes/read drafts after authoritative active-admin guard; src/server/db/REGISTRY.md':null,personalized:route!=='/api/universities',cache_policy_today:'private, no-store',cache_policy_target:'private, no-store',input_validation:route==='/api/universities'?'none':'zod',test_present:true,dead_or_duplicate:false,expected_status,findings:[] };
  const index=endpoints.findIndex(r=>r.route===route); if(index<0) endpoints.push(row); else endpoints[index]=row;
 }
 // M2 adds an idempotent save method to the existing event endpoint.
 const eventSave = endpoints.find(row => row.route === '/api/events/[id]/save');
 eventSave.methods = ['DELETE','POST','PUT'];
 fs.writeFileSync(base+'endpoints.json',JSON.stringify(endpoints,null,2)+'\n');
 const pages=JSON.parse(fs.readFileSync(base+'pages.json','utf8'));
 for(const route of M1_M2_PAGES) {
  const admin=route.startsWith('/moderation/');
  const row={id:route.slice(1).replace(/[\[\]]/g,'').replaceAll('/','.'),file:'src/app'+route+'/page.tsx',route,component_type:'server',data_source:admin?'api:/api/admin/opportunities+/api/admin/events/[id]/discovery':'api:discovery/saved/opportunities',middleware_protected:false,layout_guard:admin?'src/app/moderation/layout.tsx':null,page_guard:admin?'requireAdminPage':'requireDiscoveryPage',effective_protection:admin?'admin':'feature',render_mode:'unknown',dead_or_duplicate:false,findings:[]};
  const index=pages.findIndex(r=>r.route===route); if(index<0)pages.push(row); else pages[index]=row;
 }
 fs.writeFileSync(base+'pages.json',JSON.stringify(pages,null,2)+'\n');
}
if(process.argv.includes('--write')) updateM1M2Inventory();
