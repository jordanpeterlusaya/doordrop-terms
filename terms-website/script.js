document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('section').forEach((sec) => {
    const h2 = sec.querySelector('h2');
    h2.addEventListener('click', () => {
      sec.classList.toggle('collapsed');
    });
  });

  const printBtn = document.getElementById('printBtn');
  if (printBtn) printBtn.addEventListener('click', () => window.print());
});
