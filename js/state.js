// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
let state={
  censosData:[{ano:1991,pop:78420},{ano:2000,pop:95310},{ano:2010,pop:108760},{ano:2022,pop:127500}],
  municipioNome:'Município Exemplo',municipioCod:'',municipioUF:'',
  municipioLat:null,municipioLon:null,municipioArea:null,
  bestModel:'geometrico',
  r2:{aritmetico:0,geometrico:0,logistico:0,holt:0},
  rmse:{aritmetico:0,geometrico:0,logistico:0,holt:0},
  scores:{aritmetico:0,geometrico:0,logistico:0,holt:0},
  loo:{aritmetico:null,geometrico:null,logistico:null,holt:null},
  coefs:{},K:null,
  infraAnoIdx:0,infraAnos:[2025,2030,2035,2043],
  projData:[],censosRaw:null,
  charts:{},mapaL:null,
  adAnoIdx:0,
  config:{responsavel:'',empresa:'',revisao:'Rev. 00',obs:''},
  auditLog:[],cmpB:null
};

const modelLabel={aritmetico:'Aritmético',geometrico:'Geométrico',logistico:'Logístico',holt:'Holt'};
const modelColors={aritmetico:'#4f7ef5',geometrico:'#1D9E75',logistico:'#E24B4A',holt:'#e09000'};

// Eventos de tendência (usado em eventos.js)
let eventos=[];
