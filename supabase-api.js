/* ===== SUPABASE API PUBLICA ===== */
const SUPABASE_URL = 'https://mknhezrdzhtangvuzkvq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gE7-6xmZFCPrLPbJLEjy2w_4RoC8puw';

const SUPABASE_DEFAULT_TABLES = [
  'historial_mediciones',
  'lecturas_24h',
  'dashboard_actual',
  'mediciones',
  'lecturas',
  'registros',
  'sensor_readings',
  'readings'
];

const SUPABASE_TIME_COLUMNS = [
  'created_at',
  'fecha_hora',
  'fecha',
  'timestamp',
  'time',
  'inserted_at'
];

const SUPABASE_VALUE_COLUMNS = {
  temperatura: ['temperatura', 'temp', 'temperature'],
  humedad: ['humedad', 'hum', 'humidity'],
  presion: ['presion', 'presion_pa', 'pressure', 'pressure_pa']
};

function _getSupabasePublishableKey() {
  const key = (
    window.SUPABASE_PUBLISHABLE_KEY ||
    _readLocalStorage('SUPABASE_PUBLISHABLE_KEY') ||
    SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  if (!key) {
    const error = new Error(
      'Falta configurar SUPABASE_PUBLISHABLE_KEY en supabase-api.js. ' +
      'Debe ser la Publishable key publica de Supabase, no service_role ni secret key.'
    );
    error.isSupabaseConfigError = true;
    throw error;
  }

  if (key.startsWith('sb_secret_')) {
    const error = new Error('La key configurada parece ser una secret key. Use solo la Publishable key publica.');
    error.isSupabaseConfigError = true;
    throw error;
  }

  const jwtPayload = _decodeJwtPayload(key);
  if (jwtPayload?.role === 'service_role') {
    const error = new Error('La key configurada es service_role. Use solo la Publishable key publica.');
    error.isSupabaseConfigError = true;
    throw error;
  }

  return key;
}

function _readLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function _decodeJwtPayload(value) {
  const parts = value.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function _supabaseGet(path, params = {}) {
  const key = _getSupabasePublishableKey();
  const url = new URL(path, `${SUPABASE_URL}/rest/v1/`);

  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(name, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Error consultando Supabase (${response.status}): ${detail}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  return response.json();
}

async function _queryFirstAvailableTable({ tables, limit = 100, since = null, single = false } = {}) {
  const candidates = _unique([
    ...(tables || []),
    window.SUPABASE_TABLE_NAME,
    ...SUPABASE_DEFAULT_TABLES
  ].filter(Boolean));

  const errors = [];

  for (const table of candidates) {
    const timeColumns = since ? SUPABASE_TIME_COLUMNS : [...SUPABASE_TIME_COLUMNS, null];

    for (const timeColumn of timeColumns) {
      try {
        const params = {
          select: '*',
          limit: single ? 1 : limit
        };

        if (timeColumn) {
          params.order = `${timeColumn}.desc`;
          if (since) params[timeColumn] = `gte.${since.toISOString()}`;
        }

        const data = await _supabaseGet(table, params);
        return {
          table,
          timeColumn,
          data: single ? data[0] || null : data
        };
      } catch (error) {
        if (error.isSupabaseConfigError) throw error;
        errors.push(`${table}${timeColumn ? `.${timeColumn}` : ''}: ${error.message}`);
      }
    }
  }

  throw new Error(`No se pudo leer ninguna tabla publica de Supabase. Intentos: ${errors.join(' | ')}`);
}

function _unique(values) {
  return [...new Set(values)];
}

function _firstValue(row, aliases) {
  if (!row) return null;
  const key = aliases.find(name => Object.prototype.hasOwnProperty.call(row, name));
  return key ? row[key] : null;
}

function _mapDashboardRow(row, timeColumn) {
  return {
    medicion: row,
    fecha: timeColumn ? row?.[timeColumn] ?? null : null,
    temperatura: _firstValue(row, SUPABASE_VALUE_COLUMNS.temperatura),
    humedad: _firstValue(row, SUPABASE_VALUE_COLUMNS.humedad),
    presion: _firstValue(row, SUPABASE_VALUE_COLUMNS.presion)
  };
}

async function obtenerDashboardActual() {
  const viewResult = await _queryFirstAvailableTable({
    tables: ['dashboard_actual', 'ultima_medicion', 'mediciones'],
    single: true
  });

  return _mapDashboardRow(viewResult.data, viewResult.timeColumn);
}

async function obtenerLecturas24h() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await _queryFirstAvailableTable({
    tables: ['lecturas_24h', 'mediciones', 'lecturas'],
    limit: 1440,
    since
  });

  return result.data;
}

async function obtenerHistorialMediciones() {
  const result = await _queryFirstAvailableTable({
    tables: ['historial_mediciones', 'mediciones', 'lecturas'],
    limit: 500
  });

  return result.data;
}

window.obtenerDashboardActual = obtenerDashboardActual;
window.obtenerLecturas24h = obtenerLecturas24h;
window.obtenerHistorialMediciones = obtenerHistorialMediciones;
