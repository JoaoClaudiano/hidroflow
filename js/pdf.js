// PDF TEMPLATE
function gerarPDFTemplate(){
  var jsPDF=null;
  if(window.jspdf&&window.jspdf.jsPDF){jsPDF=window.jspdf.jsPDF;}
  else if(typeof window.jsPDF!=='undefined'){jsPDF=window.jsPDF;}
  if(!jsPDF){alert('jsPDF não encontrado. Use o botão Imprimir / PDF ou instale jsPDF.');return;}

  var doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  var pageW=210,pageH=297,margin=20,y=margin,lineH=7;
  var totalPages=1;

  function addHeader(){
    doc.setFillColor(26,79,214);
    doc.rect(0,0,pageW,14,'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.setTextColor(255,255,255);
    doc.text('HidroFlow v5.0',margin,9);
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    var title=state&&state.municipioNome?state.municipioNome:'';
    doc.text(title,pageW/2,9,{align:'center'});
    doc.text(new Date().toLocaleDateString('pt-BR'),pageW-margin,9,{align:'right'});
    doc.setTextColor(0,0,0);
    y=22;
  }

  function addFooter(pageNum,total){
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(100,100,100);
    doc.text('HidroFlow v5.0 | Página '+pageNum+' de '+total,pageW/2,pageH-8,{align:'center'});
    doc.setTextColor(0,0,0);
  }

  function checkY(needed){
    if(y+needed>pageH-20){doc.addPage();totalPages++;y=margin;addHeader();}
  }

  function addSectionTitle(txt){
    checkY(12);
    doc.setFillColor(240,244,255);
    doc.rect(margin,y-4,pageW-margin*2,9,'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.setTextColor(26,79,214);
    doc.text(txt,margin,y+1);
    doc.setTextColor(0,0,0);
    y+=10;
  }

  function addText(txt,size,bold){
    checkY(lineH);
    doc.setFont('helvetica',bold?'bold':'normal');
    doc.setFontSize(size||10);
    var lines=doc.splitTextToSize(txt,pageW-margin*2);
    doc.text(lines,margin,y);
    y+=lines.length*lineH;
  }

  // Cover page
  addHeader();
  doc.setFillColor(26,79,214);
  doc.rect(0,50,pageW,60,'F');
  doc.setFont('helvetica','bold');
  doc.setFontSize(28);
  doc.setTextColor(255,255,255);
  doc.text('HidroFlow',pageW/2,80,{align:'center'});
  doc.setFontSize(14);
  doc.text('Memorial de Calculo',pageW/2,92,{align:'center'});
  doc.setFont('helvetica','normal');
  doc.setFontSize(12);
  var mun=(state&&state.municipioNome)||'';
  var uf=(state&&state.municipioUF)||'';
  doc.text(mun+(uf?' - '+uf:''),pageW/2,104,{align:'center'});
  doc.setTextColor(0,0,0);
  y=130;
  doc.setFont('helvetica','normal');
  doc.setFontSize(10);
  var resp=(state&&state.config&&state.config.responsavel)||'';
  var empresa=(state&&state.config&&state.config.empresa)||'';
  var rev=(state&&state.config&&state.config.revisao)||'Rev. 00';
  if(resp)addText('Responsável: '+resp,10,false);
  if(empresa)addText('Empresa: '+empresa,10,false);
  addText('Revisão: '+rev,10,false);
  addText('Data: '+new Date().toLocaleDateString('pt-BR'),10,false);
  addFooter(1,totalPages);

  // Page 2: dados
  doc.addPage();totalPages++;y=margin;
  addHeader();
  addSectionTitle('1. Dados Populacionais');
  if(state&&state.censosRaw){
    addText('Município: '+mun+(uf?' ('+uf+')':''),10,false);
    addText('Modelo recomendado: '+(state.bestModel||'-'),10,false);
    if(state.r2&&state.bestModel){addText('R2: '+(state.r2[state.bestModel]*100).toFixed(1)+'%',10,false);}
    y+=4;
    addText('Censos utilizados:',10,true);
    state.censosRaw.forEach(function(c){addText('  '+c.ano+': '+c.pop.toLocaleString('pt-BR')+' hab',9,false);});
  } else {
    addText('Nenhum dado de censo disponível.',10,false);
  }
  try{
    var cvBf=document.getElementById('chart-bestfit');
    if(cvBf){var imgBf=cvBf.toDataURL('image/png');checkY(80);doc.addImage(imgBf,'PNG',margin,y,pageW-margin*2,70);y+=74;}
  }catch(_){}

  doc.addPage();totalPages++;y=margin;
  addHeader();
  addSectionTitle('2. Projeção Populacional');
  if(state&&state.projData&&state.projData.length){
    var last=state.projData[state.projData.length-1];
    addText('Horizonte: '+last.ano,10,false);
    addText('População projetada: '+last.pop.toLocaleString('pt-BR')+' hab',10,false);
  } else {
    addText('Projeção não executada.',10,false);
  }
  try{
    var cvPj=document.getElementById('chart-projecao');
    if(cvPj){var imgPj=cvPj.toDataURL('image/png');checkY(80);doc.addImage(imgPj,'PNG',margin,y,pageW-margin*2,70);y+=74;}
  }catch(_){}

  doc.addPage();totalPages++;y=margin;
  addHeader();
  addSectionTitle('3. Dimensionamento de Infraestrutura');
  addText('Consulte a aba Dimensionamento para os valores detalhados de vazoes, volumes e obras.',10,false);

  var numPages=doc.internal.getNumberOfPages();
  for(var pg=1;pg<=numPages;pg++){
    doc.setPage(pg);
    addFooter(pg,numPages);
  }

  doc.save('hidroflow-'+mun.replace(/\s+/g,'-').toLowerCase()+'-memorial.pdf');
}
