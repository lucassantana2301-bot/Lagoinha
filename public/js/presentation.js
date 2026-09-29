document.addEventListener('DOMContentLoaded',()=>{
  const button=document.getElementById('themeToggle');
  document.body.classList.toggle('dark',localStorage.getItem('parking-theme')==='dark');
  button.addEventListener('click',()=>{const dark=document.body.classList.toggle('dark');localStorage.setItem('parking-theme',dark?'dark':'light');button.setAttribute('aria-pressed',String(dark));});
  const wrapper=document.getElementById('videoBoxWrapper');
  function placeCanvas(){const editing=document.getElementById('tab-editor').classList.contains('active');document.getElementById(editing?'editorCanvasHome':'overviewCanvasHome').appendChild(wrapper);}
  document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',placeCanvas));placeCanvas();
});