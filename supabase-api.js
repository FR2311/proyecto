/* ===== SUPABASE API PUBLICA ===== */
const SUPABASE_URL = 'https://mknhezrdzhtangvuzkvq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gE7-6xmZFCPrLPbJLEjy2w_4RoC8puw";
const SUPABASE_LOGIN_PAGE = 'login.html';
const SUPABASE_REMEMBER_SESSION_KEY = 'datalogger_remember_session';
const SUPABASE_TAB_SESSION_KEY = 'datalogger_tab_session';

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

let _supabaseClient = null;

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

function obtenerClienteSupabase() {
  const key = _getSupabasePublishableKey();

  if (_supabaseClient) return _supabaseClient;

  if (window.supabase?.auth?.getSession) {
    _supabaseClient = window.supabase;
    return _supabaseClient;
  }

  if (!window.supabase?.createClient) {
    throw new Error('Falta cargar @supabase/supabase-js antes de supabase-api.js.');
  }

  _supabaseClient = window.supabase.createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  window.supabase = _supabaseClient;
  return _supabaseClient;
}

async function obtenerSesionActual() {
  try {
    const supabase = obtenerClienteSupabase();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Error obteniendo sesión:", error);
      return null;
    }

    if (!data.session) return null;
    if (_sesionPermitidaEnEsteDispositivo()) return data.session;

    await _cerrarSesionLocal(supabase);
    return null;
  } catch (error) {
    console.error("Error obteniendo sesión:", error);
    return null;
  }
}

function _redirectActual() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function redirigirALogin() {
  if (window.location.pathname.endsWith(`/${SUPABASE_LOGIN_PAGE}`)) return;

  const loginUrl = new URL(SUPABASE_LOGIN_PAGE, window.location.href);
  loginUrl.searchParams.set('redirect', _redirectActual());
  window.location.href = loginUrl.toString();
}

async function protegerPagina() {
  const session = await obtenerSesionActual();

  if (!session) {
    redirigirALogin();
    return null;
  }

  return session;
}

async function iniciarSesion(email, password, options = {}) {
  const supabase = obtenerClienteSupabase();
  const result = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (!result.error && result.data?.session) {
    _registrarSesionActiva(Boolean(options.recordarSesion));
  }

  return result;
}

async function cerrarSesion(options = {}) {
  const supabase = obtenerClienteSupabase();
  _limpiarPreferenciaSesion();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  if (options.redirigir !== false) window.location.href = SUPABASE_LOGIN_PAGE;
}

async function _getSessionAccessToken() {
  const session = await obtenerSesionActual();

  if (!session?.access_token) {
    redirigirALogin();
    const error = new Error('No hay sesion activa. Redirigiendo a login.html.');
    error.isAuthRedirect = true;
    throw error;
  }

  return session.access_token;
}

function _readLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function _writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function _removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function _readSessionStorage(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function _writeSessionStorage(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

function _removeSessionStorage(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

function _registrarSesionActiva(recordarSesion) {
  _writeSessionStorage(SUPABASE_TAB_SESSION_KEY, '1');

  if (recordarSesion) {
    _writeLocalStorage(SUPABASE_REMEMBER_SESSION_KEY, '1');
  } else {
    _removeLocalStorage(SUPABASE_REMEMBER_SESSION_KEY);
  }
}

function _limpiarPreferenciaSesion() {
  _removeSessionStorage(SUPABASE_TAB_SESSION_KEY);
  _removeLocalStorage(SUPABASE_REMEMBER_SESSION_KEY);
}

function _sesionPermitidaEnEsteDispositivo() {
  return _readLocalStorage(SUPABASE_REMEMBER_SESSION_KEY) === '1' ||
    _readSessionStorage(SUPABASE_TAB_SESSION_KEY) === '1';
}

async function _cerrarSesionLocal(supabase) {
  _limpiarPreferenciaSesion();

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {}
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
  const accessToken = await _getSessionAccessToken();
  const url = new URL(path, `${SUPABASE_URL}/rest/v1/`);

  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(name, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
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
        if (error.isAuthRedirect) throw error;
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
window.obtenerClienteSupabase = obtenerClienteSupabase;
window.obtenerSesionActual = obtenerSesionActual;
window.iniciarSesion = iniciarSesion;
window.protegerPagina = protegerPagina;
window.cerrarSesion = cerrarSesion;

try {
  obtenerClienteSupabase();
} catch (error) {
  console.error('Error inicializando Supabase:', error);
}
