/**
 * MODIFICACIONES PARA REGISTRO AUTOMÁTICO DE VISITAS
 * Este archivo contiene las funciones para registrar visitas automáticamente
 * cuando se reproduce un video o se visualiza una imagen
 */

// Función para registrar una visita
async function recordMediaView(mediaId) {
  try {
    const response = await fetch('/api/increment-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId })
    });
    const data = await response.json();
    if (data.ok) {
      console.log(`✓ Visita registrada. Total: ${data.views}`);
      return data.views;
    }
  } catch (error) {
    console.error('Error registrando visita:', error);
  }
}

// Agregar listeners a videos para registrar visita automáticamente
function addVideoViewListener(videoElement, mediaId) {
  let viewRecorded = false;
  
  // Registrar visita cuando el video comienza a reproducirse
  videoElement.addEventListener('play', async () => {
    if (!viewRecorded) {
      viewRecorded = true;
      await recordMediaView(mediaId);
    }
  });
  
  // También registrar si se alcanza el 50% del video
  videoElement.addEventListener('timeupdate', async () => {
    if (!viewRecorded && videoElement.currentTime >= videoElement.duration * 0.5) {
      viewRecorded = true;
      await recordMediaView(mediaId);
    }
  });
}

// Agregar listeners a imágenes para registrar visita automáticamente
function addImageViewListener(imageElement, mediaId) {
  let viewRecorded = false;
  
  // Registrar visita cuando la imagen se carga completamente
  if (imageElement.complete) {
    // La imagen ya está cargada
    viewRecorded = true;
    recordMediaView(mediaId);
  } else {
    // Esperar a que la imagen se cargue
    imageElement.addEventListener('load', async () => {
      if (!viewRecorded) {
        viewRecorded = true;
        await recordMediaView(mediaId);
      }
    });
  }
}

// Función para inicializar listeners en una galería
function initializeGalleryViewListeners(galleryContainer) {
  const videos = galleryContainer.querySelectorAll('video[data-media-id]');
  const images = galleryContainer.querySelectorAll('img[data-media-id]');
  
  videos.forEach(video => {
    const mediaId = video.getAttribute('data-media-id');
    addVideoViewListener(video, mediaId);
  });
  
  images.forEach(img => {
    const mediaId = img.getAttribute('data-media-id');
    addImageViewListener(img, mediaId);
  });
}

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    recordMediaView,
    addVideoViewListener,
    addImageViewListener,
    initializeGalleryViewListeners
  };
}
