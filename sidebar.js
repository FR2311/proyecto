/* Lógica del sidebar deslizable en móvil */
(function () {
  function init() {
    const sidebar  = document.querySelector('.sidebar');
    const overlay  = document.querySelector('.sidebar-overlay');
    const hamburger = document.querySelector('.hamburger');
    if (!sidebar || !overlay || !hamburger) return;

    function open() {
      sidebar.classList.add('open');
      overlay.classList.add('visible');
      hamburger.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function close() {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
      hamburger.classList.remove('open');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', () => {
      sidebar.classList.contains('open') ? close() : open();
    });

    overlay.addEventListener('click', close);

    // Cerrar con Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
    });

    // Cerrar al navegar (links del sidebar)
    sidebar.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', () => {
        // Solo en móvil
        if (window.innerWidth <= 640) close();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
