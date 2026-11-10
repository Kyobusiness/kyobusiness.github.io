'use strict';
const root='/testsiteportal/';
const authServer='https://testsiteportal.kyosuke-0101.chatgpt.site';
const form=document.querySelector('form'),input=form.elements.password;
const ready=navigator.serviceWorker.register(root+'sw.js',{scope:root})
  .then(()=>navigator.serviceWorker.ready);
ready.then(()=>{input.disabled=false;form.querySelector('button').disabled=false;}).catch(()=>{form.classList.add('unavailable');});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=form.querySelector('button');
  button.disabled=true;
  try {
    const reg=await ready;
    const res=await fetch(authServer+'/_pages/login',{method:'POST',body:new URLSearchParams({password:input.value}),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
    if(!res.ok) throw Error();
    const session=await res.json(), channel=new MessageChannel();
    const ack=new Promise((resolve,reject)=>{
      const timer=setTimeout(reject,10000);
      channel.port1.onmessage=e=>{clearTimeout(timer);e.data===true?resolve():reject();};
    });
    reg.active.postMessage({session},[channel.port2]); await ack;
    location.reload();
  }catch{
    form.querySelector('.entry').classList.add('invalid');input.setAttribute('aria-invalid','true');input.focus();input.select();
  }finally{button.disabled=false;}
});
