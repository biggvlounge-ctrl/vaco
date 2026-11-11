'use strict';

// Missouri county-equivalent pilot based on Census FIPS geography conventions.
// The 2026 TIGER/Line national county-equivalent file is the authoritative refresh source.
const MO_ENTITIES = `001|Adair|county
003|Andrew|county
005|Atchison|county
007|Audrain|county
009|Barry|county
011|Barton|county
013|Bates|county
015|Benton|county
017|Bollinger|county
019|Boone|county
021|Buchanan|county
023|Butler|county
025|Caldwell|county
027|Callaway|county
029|Camden|county
031|Cape Girardeau|county
033|Carroll|county
035|Carter|county
037|Cass|county
039|Cedar|county
041|Chariton|county
043|Christian|county
045|Clark|county
047|Clay|county
049|Clinton|county
051|Cole|county
053|Cooper|county
055|Crawford|county
057|Dade|county
059|Dallas|county
061|Daviess|county
063|DeKalb|county
065|Dent|county
067|Douglas|county
069|Dunklin|county
071|Franklin|county
073|Gasconade|county
075|Gentry|county
077|Greene|county
079|Grundy|county
081|Harrison|county
083|Henry|county
085|Hickory|county
087|Holt|county
089|Howard|county
091|Howell|county
093|Iron|county
095|Jackson|county
097|Jasper|county
099|Jefferson|county
101|Johnson|county
103|Knox|county
105|Laclede|county
107|Lafayette|county
109|Lawrence|county
111|Lewis|county
113|Lincoln|county
115|Linn|county
117|Livingston|county
119|McDonald|county
121|Macon|county
123|Madison|county
125|Maries|county
127|Marion|county
129|Mercer|county
131|Miller|county
133|Mississippi|county
135|Moniteau|county
137|Monroe|county
139|Montgomery|county
141|Morgan|county
143|New Madrid|county
145|Newton|county
147|Nodaway|county
149|Oregon|county
151|Osage|county
153|Ozark|county
155|Pemiscot|county
157|Perry|county
159|Pettis|county
161|Phelps|county
163|Pike|county
165|Platte|county
167|Polk|county
169|Pulaski|county
171|Putnam|county
173|Ralls|county
175|Randolph|county
177|Ray|county
179|Reynolds|county
181|Ripley|county
183|St. Charles|county
185|St. Clair|county
186|Ste. Genevieve|county
187|St. Francois|county
189|St. Louis|county
195|Saline|county
197|Schuyler|county
199|Scotland|county
201|Scott|county
203|Shannon|county
205|Shelby|county
207|Stoddard|county
209|Stone|county
211|Sullivan|county
213|Taney|county
215|Texas|county
217|Vernon|county
219|Warren|county
221|Washington|county
223|Wayne|county
225|Webster|county
227|Worth|county
229|Wright|county
510|St. Louis city|independent_city`;

const fs=require('node:fs');
const path=require('node:path');
const NATIONAL_PATH=path.join(__dirname,'data','national-county-equivalents.json');
const CATEGORIES = Object.freeze(['assessor','recorder','tax_collector','foreclosure_court_sheriff','auction','land_bank_redevelopment','planning_zoning_permits','gis_parcels','code_vacancy']);
const MISSOURI_COUNTY_EQUIVALENTS = Object.freeze(MO_ENTITIES.split('\n').map(line=>{
  const [fips,name,entityType]=line.split('|');
  return Object.freeze({geoid:`29${fips}`,state:'MO',stateFips:'29',countyFips:fips,name,entityType,coverageStatus:'not_assessed',categories:Object.freeze(CATEGORIES.map(category=>Object.freeze({category,status:'not_assessed',sourceCount:0}))) });
}));

function loadNationalCountyEquivalents(){if(!fs.existsSync(NATIONAL_PATH))return null;try{const payload=JSON.parse(fs.readFileSync(NATIONAL_PATH,'utf8'));if(!Array.isArray(payload.records))return null;return payload.records.map(record=>({...record,coverageStatus:'not_assessed',categories:CATEGORIES.map(category=>({category,status:'not_assessed',sourceCount:0}))}));}catch{return null;}}
function listCountyEquivalents({state='MO',q,category,status}={}) {
  const normalizedState=String(state||'MO').toUpperCase();
  const national=loadNationalCountyEquivalents();
  let items=national?national.filter(x=>x.state===normalizedState):(normalizedState==='MO'?[...MISSOURI_COUNTY_EQUIVALENTS]:[]);
  const term=String(q||'').toLowerCase().trim();
  if(term) items=items.filter(x=>`${x.name} ${x.geoid} ${x.state}`.toLowerCase().includes(term));
  if(category) items=items.filter(x=>x.categories.some(c=>c.category===category&&(!status||c.status===status)));
  else if(status) items=items.filter(x=>x.coverageStatus===status||x.categories.some(c=>c.status===status));
  return items;
}
function coverageSummary(items=listCountyEquivalents()) {
  const categories=CATEGORIES.map(category=>({category,totalJurisdictions:items.length,sourceLocated:items.filter(x=>x.categories.find(c=>c.category===category)?.status==='source_located').length,connected:items.filter(x=>x.categories.find(c=>c.category===category)?.status==='connected').length,notAssessed:items.filter(x=>x.categories.find(c=>c.category===category)?.status==='not_assessed').length}));
  return {jurisdictions:items.length,statesCovered:[...new Set(items.map(x=>x.state))],categories,notice:'Coverage statuses are deliberately conservative. This pilot lists Missouri county-equivalent geography; source discovery and connection must be recorded separately.'};
}
function countyDirectoryStatus(){const national=loadNationalCountyEquivalents();return national?{status:'national_imported',recordCount:national.length,vintage:JSON.parse(fs.readFileSync(NATIONAL_PATH,'utf8')).vintage,source:'Census TIGER/Line'}:{status:'missouri_pilot',recordCount:MISSOURI_COUNTY_EQUIVALENTS.length,source:'Missouri pilot inventory'};}
module.exports={CATEGORIES,MISSOURI_COUNTY_EQUIVALENTS,listCountyEquivalents,coverageSummary,countyDirectoryStatus,NATIONAL_PATH};
