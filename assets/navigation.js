const VIEWS=new Set(['home','library','stats','leaderboard','friends','rooms','room','rewards','appearance','account','bug-report','privacy','cookies','terms','legal','help']);
const CATEGORIES=new Set(['screenshot','character','opening','ending','anidle']);
export function readRoute(hash,defaultMode='infinity'){
 const [path,query='']=String(hash||'').replace(/^#/,'').split('?');const [page,category]=path.split('/');
 const requested=new URLSearchParams(query).get('mode');const mode=['daily','infinity'].includes(requested)?requested:defaultMode==='daily'?'daily':'infinity';
 if(page==='game'&&CATEGORIES.has(category))return {view:'game',selected:category,mode};
 return {view:VIEWS.has(page)?page:'home',selected:null,mode};
}
export function routeHash({view,selected,mode}){
 const route=readRoute('#'+(view==='game'?'game/'+selected:view)+'?mode='+mode,mode);
 return '#'+(route.view==='game'?'game/'+route.selected:route.view)+'?mode='+route.mode;
}
