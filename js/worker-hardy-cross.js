// Hardy-Cross Web Worker
// Receives: {nodes, pipes}
// Posts: {nodes, pipes, iters, nLoops} or {error: msg}

function hwResistance(pipe){
  var D=pipe.dn/1000;
  return 10.643*pipe.length/(Math.pow(pipe.c||120,1.852)*Math.pow(D,4.87));
}

function hwHeadloss(R,Q){
  return R*Math.sign(Q)*Math.pow(Math.abs(Q),1.852);
}

function initFlows(nodes,pipes,source){
  var adj={};
  nodes.forEach(function(n){adj[n.id]=[];});
  pipes.forEach(function(p){
    if(adj[p.from])adj[p.from].push({to:p.to,pipe:p});
    if(adj[p.to])adj[p.to].push({to:p.from,pipe:p});
  });
  var pred={};
  var visited={};
  visited[source.id]=true;
  var bfsOrder=[source.id];
  var queue=[source.id];
  var treeEdgeIds={};
  while(queue.length){
    var u=queue.shift();
    (adj[u]||[]).forEach(function(e){
      if(!visited[e.to]){
        visited[e.to]=true;
        pred[e.to]={parent:u,pipe:e.pipe};
        treeEdgeIds[e.pipe.id]=true;
        bfsOrder.push(e.to);
        queue.push(e.to);
      }
    });
  }
  pipes.forEach(function(p){p.flow=0.001;});
  var demand={};
  nodes.forEach(function(n){demand[n.id]=n.demand||0;});
  for(var i=bfsOrder.length-1;i>=1;i--){
    var v=bfsOrder[i];
    var entry=pred[v];
    var flow=Math.max(demand[v],0.001);
    entry.pipe.flow=entry.pipe.from===entry.parent?flow:-flow;
    demand[entry.parent]=(demand[entry.parent]||0)+demand[v];
  }
}

function findLoops(nodes,pipes){
  if(!nodes.length||!pipes.length)return[];
  var adj={};
  nodes.forEach(function(n){adj[n.id]=[];});
  pipes.forEach(function(p){
    if(adj[p.from])adj[p.from].push({to:p.to,pipe:p});
    if(adj[p.to])adj[p.to].push({to:p.from,pipe:p});
  });
  var loops=[];
  var globalVisited={};
  nodes.forEach(function(startNode){
    if(globalVisited[startNode.id])return;
    var pred={};
    var visited={};
    visited[startNode.id]=true;
    var queue=[startNode.id];
    var treeEdgeIds={};
    while(queue.length){
      var u=queue.shift();
      (adj[u]||[]).forEach(function(e){
        if(!visited[e.to]){
          visited[e.to]=true;
          pred[e.to]={parent:u,pipe:e.pipe};
          treeEdgeIds[e.pipe.id]=true;
          queue.push(e.to);
        }
      });
    }
    Object.keys(visited).forEach(function(id){globalVisited[id]=true;});
    function pathToRoot(nodeId){
      var path=[nodeId];var cur=nodeId;
      while(pred[cur]){cur=pred[cur].parent;path.push(cur);}
      return path;
    }
    pipes.forEach(function(p){
      if(treeEdgeIds[p.id])return;
      if(!visited[p.from]||!visited[p.to])return;
      var ancestorsA=pathToRoot(p.from);
      var setA={};
      ancestorsA.forEach(function(n,i){setA[n]=i;});
      var ancestorsB=[];
      pathToRoot(p.to).forEach(function(n){
        ancestorsB.push(n);
        if(setA[n]!==undefined)return;
      });
      var lca=null;
      for(var i=0;i<ancestorsB.length;i++){
        if(setA[ancestorsB[i]]!==undefined){lca=ancestorsB[i];break;}
      }
      if(!lca)return;
      var lcaIdxA=setA[lca];
      var segA=ancestorsA.slice(0,lcaIdxA);
      var segB=ancestorsB.slice(0,ancestorsB.indexOf(lca)).reverse();
      var cycleNodes=segA.concat([lca]).concat(segB).concat([p.from]);
      var loop=[];
      var allCycleNodes=segA.concat([lca]).concat(segB);
      for(var j=0;j<allCycleNodes.length-1;j++){
        var a=allCycleNodes[j],b=allCycleNodes[j+1];
        var ep=pipes.find(function(pp){return(pp.from===a&&pp.to===b)||(pp.from===b&&pp.to===a);});
        if(ep)loop.push({pipe:ep,dir:ep.from===a?1:-1});
      }
      var last=allCycleNodes[allCycleNodes.length-1];
      var first=allCycleNodes[0];
      var closePipe=pipes.find(function(pp){return(pp.from===last&&pp.to===first)||(pp.from===first&&pp.to===last);});
      if(closePipe)loop.push({pipe:closePipe,dir:closePipe.from===last?1:-1});
      if(loop.length>=3)loops.push(loop);
    });
  });
  return loops;
}

function calcPressures(nodes,pipes,source){
  var headMap={};
  var srcHead=(source.type==='reservoir'||source.type==='tank')?(source.head||source.elevation+20):source.elevation+20;
  headMap[source.id]=srcHead;
  var queue=[source.id];
  var visited={};
  visited[source.id]=true;
  while(queue.length){
    var curr=queue.shift();
    var hCurr=headMap[curr];
    pipes.forEach(function(p){
      if(p.from===curr||p.to===curr){
        var next=p.from===curr?p.to:p.from;
        if(!visited[next]){
          visited[next]=true;
          queue.push(next);
          var dir=p.from===curr?1:-1;
          var R=hwResistance(p);
          var hf=hwHeadloss(R,p.flow/1000*dir);
          headMap[next]=hCurr-hf;
        }
      }
    });
  }
  nodes.forEach(function(n){
    var h=headMap[n.id]||n.elevation+10;
    n.pressure=h-n.elevation;
    if(n.pressure<0)n.pressure=0;
  });
}

function runHardyCrossWorker(nodes,pipes){
  var source=nodes.find(function(n){return n.type==='reservoir'||n.type==='tank';});
  if(!source)return{error:'Adicione pelo menos um reservatorio ou caixa-d-agua.'};
  if(nodes.length<2||!pipes.length)return{error:'Rede insuficiente: adicione nos e trechos.'};

  initFlows(nodes,pipes,source);
  var loops=findLoops(nodes,pipes);
  var nLoops=loops.length;

  var MAX_ITER=100,TOL=0.0001,iter=0;
  var maxDQ=Infinity;
  while(maxDQ>TOL&&iter<MAX_ITER){
    maxDQ=0;
    if(loops.length>0){
      loops.forEach(function(loop){
        var sumHF=0,sumHFQ=0;
        loop.forEach(function(le){
          var Q_m3s=le.pipe.flow/1000;
          var R=hwResistance(le.pipe);
          var hf=hwHeadloss(R,Q_m3s*le.dir);
          sumHF+=hf;
          sumHFQ+=1.852*R*Math.pow(Math.abs(Q_m3s),0.852);
        });
        var dQ=sumHFQ>0?-(sumHF/(2*sumHFQ))*1000:0;
        loop.forEach(function(le){le.pipe.flow+=dQ*le.dir;});
        maxDQ=Math.max(maxDQ,Math.abs(dQ));
      });
    } else {
      break;
    }
    iter++;
  }

  calcPressures(nodes,pipes,source);

  pipes.forEach(function(p){
    var D=p.dn/1000;
    var A=Math.PI*Math.pow(D/2,2);
    p.velocity=Math.abs(p.flow/1000)/A;
    var R=hwResistance(p);
    p.headloss=Math.abs(hwHeadloss(R,p.flow/1000));
    p.calculated=true;
  });
  nodes.forEach(function(n){n.calculated=true;});

  return{nodes:nodes,pipes:pipes,iters:iter,nLoops:nLoops};
}

self.addEventListener('message',function(e){
  try{
    var data=e.data;
    var result=runHardyCrossWorker(data.nodes,data.pipes);
    if(result.error){self.postMessage({error:result.error});}
    else{self.postMessage({nodes:result.nodes,pipes:result.pipes,iters:result.iters,nLoops:result.nLoops});}
  }catch(err){
    self.postMessage({error:err.message||'Erro no worker Hardy-Cross'});
  }
});
