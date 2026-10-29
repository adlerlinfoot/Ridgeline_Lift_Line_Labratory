// Keep internal identifiers for graph operations, not automatic map labels.
export function displayName(element){
 const name=typeof element?.name==='string'?element.name.trim():'';
 if(!name||name===element.id||/^(?:new|unnamed|untitled|default)(?:[\s_-]+(?:node|route|run|junction|lift|transfer))?(?:[\s_#-]*\d+)?(?:\s*[·-]\s*lower)*$/i.test(name))return '';
 return name;
}
