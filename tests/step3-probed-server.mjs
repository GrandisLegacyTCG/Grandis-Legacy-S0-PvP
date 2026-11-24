/* Test-only memory probe. Never imported by production server or Docker. */
process.on('SIGUSR2',()=>{
 try{
  if(typeof global.gc==='function'){global.gc();global.gc()}
  const m=process.memoryUsage();
  console.log('STEP3_MEM '+JSON.stringify({rssMB:Math.round(m.rss/1048576*10)/10,heapMB:Math.round(m.heapUsed/1048576*10)/10,externalMB:Math.round(m.external/1048576*10)/10}));
 }catch(e){console.warn('STEP3_MEM_ERR',e.message)}
});
await import('../server.js');
