/* ═══════════════════════════════════════
   MAP — map.js
   Modal de mapa com Leaflet.js mostrando
   a rota entre o Cantinho do Isaias
   e o endereço de entrega selecionado.
═══════════════════════════════════════ */

let _leafletMap = null;
let _mapInitialized = false;

// ─── ABRIR MODAL DE MAPA ─────────────────────────────────────
async function openDeliveryMap(locIdx) {
  const locs = window._cachedLocations;
  if (!locs || !locs[locIdx]) {
    showToast('⚠️ Selecione um endereço antes de abrir o mapa.');
    return;
  }

  const loc = locs[locIdx];
  const modal = document.getElementById('mapModal');
  if (!modal) return;

  // Atualiza cabeçalho
  const infoEl = document.getElementById('mapModalInfo');
  if (infoEl) infoEl.textContent = `${loc.street}${loc.number ? ', ' + loc.number : ''}${loc.neighborhood ? ' — ' + loc.neighborhood : ''}`;

  // Abre o modal
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Inicializa ou reseta o mapa
  setTimeout(() => _initMap(loc), 80); // pequeno delay para o modal renderizar
}

async function _initMap(loc) {
  const mapEl = document.getElementById('deliveryMap');
  if (!mapEl) return;

  let destLat = loc.lat;
  let destLng = loc.lng;

  // Se não tiver coordenadas, geocodifica via Nominatim
  if (!destLat || !destLng) {
    const distLabel = document.getElementById('mapDistLabel');
    if (distLabel) distLabel.textContent = '🔄 Localizando endereço...';

    const query = encodeURIComponent(
      `${loc.street}${loc.number ? ' ' + loc.number : ''}, ${loc.neighborhood || ''}, ${loc.city || 'São Gonçalo'}, RJ, Brasil`
    );

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&accept-language=pt-BR`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.length > 0) {
          destLat = parseFloat(data[0].lat);
          destLng = parseFloat(data[0].lon);
        }
      }
    } catch (_) {}

    if (!destLat || !destLng) {
      document.getElementById('mapDistLabel').textContent = '⚠️ Endereço não localizado';
      document.getElementById('mapFeeInfo').textContent =
        'Não foi possível localizar as coordenadas deste endereço no mapa.';
      _renderMapFallback(mapEl);
      return;
    }
  }

  // Calcula distância e taxa
  const dist = haversineDistance(STORE_LAT, STORE_LNG, destLat, destLng);
  const fee  = calcDeliveryFee(dist);
  const bikeTime = calcBikeTime(dist);

  // Atualiza labels
  const distLabel = document.getElementById('mapDistLabel');
  if (distLabel) distLabel.textContent = `📏 ${dist.toFixed(1)} km`;

  const feeEl = document.getElementById('mapFeeInfo');
  if (feeEl) feeEl.innerHTML = `Taxa de entrega: <strong style="color:var(--fire)">R$ ${fmtPrice(fee)}</strong>`;

  // Destrói mapa anterior se existir
  if (_leafletMap) {
    _leafletMap.remove();
    _leafletMap = null;
  }

  // Centro do mapa = meio entre os dois pontos
  const centerLat = (STORE_LAT + destLat) / 2;
  const centerLng = (STORE_LNG + destLng) / 2;

  _leafletMap = L.map('deliveryMap', { zoomControl: true, attributionControl: false }).setView([centerLat, centerLng], 13);

  // Tile layer OpenStreetMap com estilo mais escuro (Carto Positron)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(_leafletMap);

  // ── Marcador da LOJA ───────────────────────────────────────
  const storeIcon = L.divIcon({
    className: '',
    html: `
      <div style="
        width: 38px; height: 38px;
        background: linear-gradient(135deg, #FF2D00, #FF6B1A);
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 14px rgba(255,45,0,0.45);
        border: 3px solid #fff;
        display: flex; align-items: center; justify-content: center;
      ">
        <span style="transform:rotate(45deg);font-size:17px;">🍔</span>
      </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -40],
  });

  L.marker([STORE_LAT, STORE_LNG], { icon: storeIcon })
    .addTo(_leafletMap)
    .bindPopup(`
      <div style="font-family:'Barlow Condensed',sans-serif;min-width:160px;">
        <strong style="font-size:1rem;color:#FF2D00;">🍔 Cantinho do Isaias</strong><br>
        <span style="font-size:0.78rem;color:#555;">Estrada São Pedro, 896<br>Vista Alegre, São Gonçalo</span>
      </div>
    `, { maxWidth: 200 })
    .openPopup();

  // ── Marcador do DESTINO ────────────────────────────────────
  const destIcon = L.divIcon({
    className: '',
    html: `
      <div style="
        width: 38px; height: 38px;
        background: linear-gradient(135deg, #1A0F05, #3D1A0A);
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        border: 3px solid #FFB800;
        display: flex; align-items: center; justify-content: center;
      ">
        <span style="transform:rotate(45deg);font-size:17px;">📦</span>
      </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -40],
  });

  const destAddr = [
    loc.street,
    loc.number,
    loc.complement,
    loc.neighborhood,
    loc.city,
  ].filter(Boolean).join(', ');

  L.marker([destLat, destLng], { icon: destIcon })
    .addTo(_leafletMap)
    .bindPopup(`
      <div style="font-family:'Barlow Condensed',sans-serif;min-width:160px;">
        <strong style="font-size:1rem;color:#1A0F05;">📦 ${loc.name}</strong><br>
        <span style="font-size:0.78rem;color:#555;">${destAddr}</span>
      </div>
    `, { maxWidth: 220 });

  // ── Linha tracejada entre os dois pontos ───────────────────
  L.polyline(
    [[STORE_LAT, STORE_LNG], [destLat, destLng]],
    {
      color: '#FF6B1A',
      weight: 3,
      opacity: 0.75,
      dashArray: '10, 8',
    }
  ).addTo(_leafletMap);

  // Ajusta o zoom para mostrar ambos os pontos
  _leafletMap.fitBounds(
    [[STORE_LAT, STORE_LNG], [destLat, destLng]],
    { padding: [55, 55] }
  );
}

// ─── FALLBACK: Mapa cinza quando sem coordenadas ──────────────
function _renderMapFallback(mapEl) {
  if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
  _leafletMap = L.map('deliveryMap').setView([STORE_LAT, STORE_LNG], 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 19,
  }).addTo(_leafletMap);

  // Só mostra a loja
  L.marker([STORE_LAT, STORE_LNG]).addTo(_leafletMap)
    .bindPopup('<strong>🍔 Cantinho do Isaias</strong>').openPopup();

  document.getElementById('mapFeeInfo').textContent =
    'Dica: adicione o endereço usando o GPS para ver a rota completa.';
}

// ─── FECHAR MODAL ─────────────────────────────────────────────
function closeMapModal() {
  const modal = document.getElementById('mapModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  // Não destroi o mapa ao fechar — apenas oculta o modal para reabertura rápida
}

// ─── Fecha ao clicar no overlay ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const mapModal = document.getElementById('mapModal');
  if (mapModal) {
    mapModal.addEventListener('click', function (e) {
      if (e.target === this) closeMapModal();
    });
  }
});

// ─── LOCATION PICKER (GEOLOCALIZAÇÃO) ─────────────────────────
let _pickerMap = null;
let _pickerMarker = null;

function openLocationPicker(lat, lng) {
  const modal = document.getElementById('locationPickerModal');
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  const preview = document.getElementById('locationPickerAddressPreview');
  if (preview) preview.textContent = 'Buscando endereço...';

  // Oculta modais abertos no cantinho-isaias.html se necessário
  const locModal = document.getElementById('locationModal');
  if (locModal && locModal.classList.contains('open')) {
    locModal.classList.remove('open');
  }

  setTimeout(() => {
    if (!_pickerMap) {
      _pickerMap = L.map('locationPickerMap', { zoomControl: true, attributionControl: false }).setView([lat, lng], 16);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(_pickerMap);

      const destIcon = L.divIcon({
        className: '',
        html: `
          <div style="
            width: 38px; height: 38px;
            background: linear-gradient(135deg, #FF2D00, #FF6B1A);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 14px rgba(255,45,0,0.45);
            border: 3px solid #fff;
            display: flex; align-items: center; justify-content: center;
          ">
            <span style="transform:rotate(45deg);font-size:17px;">📍</span>
          </div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
      });

      _pickerMarker = L.marker([lat, lng], { icon: destIcon, draggable: true }).addTo(_pickerMap);

      // Eventos
      _pickerMap.on('click', (e) => {
        _pickerMarker.setLatLng(e.latlng);
        _reverseGeocodePicker(e.latlng.lat, e.latlng.lng);
      });
      _pickerMarker.on('dragend', (e) => {
        const pos = _pickerMarker.getLatLng();
        _reverseGeocodePicker(pos.lat, pos.lng);
      });
    } else {
      _pickerMap.setView([lat, lng], 16);
      _pickerMarker.setLatLng([lat, lng]);
    }
    _pickerMap.invalidateSize();
    _reverseGeocodePicker(lat, lng);
  }, 100);
}

function closeLocationPicker() {
  const modal = document.getElementById('locationPickerModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

let _currentPickerAddress = null;

async function _reverseGeocodePicker(lat, lng) {
  const preview = document.getElementById('locationPickerAddressPreview');
  if (preview) preview.innerHTML = '<span style="color:var(--fire)">Buscando...</span>';
  
  _currentPickerAddress = { lat, lng, street: '', number: '', neighborhood: '', city: 'São Gonçalo' };

  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`
    );
    if (resp.ok) {
      const data = await resp.json();
      const a = data.address || {};
      const street = a.road || a.highway || '';
      const number = a.house_number || '';
      const neighborhood = a.suburb || a.neighbourhood || a.quarter || a.city_district || '';
      const city = a.city || a.town || a.municipality || 'São Gonçalo';
      
      _currentPickerAddress.street = street;
      _currentPickerAddress.number = number;
      _currentPickerAddress.neighborhood = neighborhood;
      _currentPickerAddress.city = city;

      const displayAddress = [street, number].filter(Boolean).join(', ');
      if (preview) preview.innerHTML = `<strong>${displayAddress || 'Rua desconhecida'}</strong><br><span style="font-size:0.75rem">${neighborhood || city}</span>`;
    }
  } catch (e) {
    if (preview) preview.innerHTML = '<span style="color:#e74c3c">Erro ao buscar endereço. Tente mover o pino.</span>';
  }
}

function confirmLocationPicker() {
  if (!_currentPickerAddress) return;

  const { lat, lng, street, number, neighborhood, city } = _currentPickerAddress;

  // Se tiver a constante global STORE_LAT/STORE_LNG
  let dist = 0;
  if (typeof STORE_LAT !== 'undefined' && typeof STORE_LNG !== 'undefined' && typeof haversineDistance === 'function') {
    dist = haversineDistance(STORE_LAT, STORE_LNG, lat, lng);
  } else if (typeof haversineDistance !== 'undefined') {
    // Para o cantinho-isaias.html, precisa definir
    dist = haversineDistance(-22.8141483, -42.9668196, lat, lng);
  }

  // Atualiza index.html se estiver na página
  const streetInput = document.getElementById('checkoutStreet');
  if (streetInput) {
    streetInput.value = street;
    streetInput.readOnly = true; // Bloqueia edição
    streetInput.style.background = 'var(--cream)';
  }
  const neighInput = document.getElementById('checkoutNeighborhood');
  if (neighInput) {
    neighInput.value = neighborhood;
    neighInput.readOnly = true;
    neighInput.style.background = 'var(--cream)';
  }
  const cityInput = document.getElementById('checkoutCity');
  if (cityInput) {
    cityInput.value = city;
    cityInput.readOnly = true;
    cityInput.style.background = 'var(--cream)';
  }

  // Atualiza variáveis da sessão
  window._lastGPSLat = lat;
  window._lastGPSLng = lng;

  if (typeof renderLogisticsPreview === 'function') {
    renderLogisticsPreview(dist, neighborhood || city);
  }

  // Focar no número e preencher se existir
  const numInput = document.getElementById('checkoutNumber');
  if (numInput) {
    numInput.value = number || '';
    if (!number) {
      numInput.focus();
    }
  }

  // Lógica para cantinho-isaias.html (página mais simples)
  const addrDist = document.getElementById('addressDist');
  if (addrDist) {
    addrDist.value = dist.toFixed(1);
    const simpleStreet = document.getElementById('addressStreet');
    if (simpleStreet) {
      const fullStreet = [street, number].filter(Boolean).join(', ');
      simpleStreet.value = fullStreet + (neighborhood ? ' - ' + neighborhood : '');
      simpleStreet.readOnly = true;
      simpleStreet.style.background = 'var(--cream)';
    }
    const simpleCity = document.getElementById('addressCity');
    if (simpleCity) {
      simpleCity.value = city;
      simpleCity.readOnly = true;
      simpleCity.style.background = 'var(--cream)';
    }
    if (typeof calcDelivery === 'function') {
      calcDelivery();
      document.getElementById('gpsOption')?.classList.add('selected');
    }
  }

  closeLocationPicker();
  if (typeof showToast === 'function') showToast('✅ Endereço capturado! Complete o número.');
}
