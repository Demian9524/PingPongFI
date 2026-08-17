// supabase/trophies.js — servicio público/admin para trofeos
(function (global) {
  'use strict';

  let injectedClient = null;

  function isRpcClient(value) {
    return !!value && typeof value.rpc === 'function';
  }

  function setClient(client) {
    if (!isRpcClient(client)) {
      throw new TypeError('SB_TROPHIES.setClient esperaba un cliente Supabase válido.');
    }
    injectedClient = client;
  }

  function getClient() {
    const candidates = [
      injectedClient,
      global.SB,
      global.SB_CLIENT,
      global.supabaseClient,
      global.SUPABASE_CLIENT,
      global.sb,
      global.SB && global.SB.client
    ];
    const client = candidates.find(isRpcClient);
    if (!client) {
      throw new Error('Cliente Supabase no disponible para SB_TROPHIES. Carga supabase/client.js primero o llama SB_TROPHIES.setClient(cliente).');
    }
    return client;
  }

  async function rpc(name, params) {
    const { data, error } = await getClient().rpc(name, params || {});
    if (error) {
      const err = new Error(error.message || ('Falló la RPC ' + name));
      err.code = error.code;
      err.details = error.details;
      err.hint = error.hint;
      throw err;
    }
    return data;
  }

  async function fetchPlayerTrophies(playerRef) {
    if (playerRef == null || String(playerRef).trim() === '') return [];
    const rows = await rpc('get_public_player_trophies', { p_ref: String(playerRef) });
    return Array.isArray(rows) ? rows : [];
  }

  async function grantTrophy(options) {
    const o = options || {};
    if (!o.registrationId) throw new TypeError('registrationId es obligatorio.');
    return rpc('admin_grant_player_trophy', {
      p_registration_id: o.registrationId,
      p_trophy_type: o.trophyType || 'CHAMPION',
      p_asset_key: o.assetKey || null,
      p_notes: o.notes || null
    });
  }

  async function grantChampionFromFinal(matchId, notes) {
    if (!matchId) throw new TypeError('matchId es obligatorio.');
    return rpc('admin_grant_champion_trophy_from_final', {
      p_match_id: matchId,
      p_notes: notes || null
    });
  }

  async function revokeTrophy(trophyId, reason) {
    if (!trophyId) throw new TypeError('trophyId es obligatorio.');
    if (!reason || !String(reason).trim()) throw new TypeError('reason es obligatorio.');
    return rpc('admin_revoke_player_trophy', {
      p_trophy_id: trophyId,
      p_reason: String(reason).trim()
    });
  }

  async function syncChampions(editionId) {
    return rpc('admin_sync_champion_trophies', {
      p_edition_id: editionId == null ? null : Number(editionId)
    });
  }

  global.SB_TROPHIES = Object.freeze({
    setClient,
    fetchPlayerTrophies,
    grantTrophy,
    grantChampionFromFinal,
    revokeTrophy,
    syncChampions
  });
})(window);
