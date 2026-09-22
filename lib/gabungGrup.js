/**
 * gabungGrup.js - Helper bergabung ke grup lewat link undangan (fitur sewa).
 *
 * Dulu tiap plugin sewa memanggil `groupAcceptInvite(...).catch(() => {})`,
 * jadi kegagalan bergabung TIDAK terlihat: bot gagal masuk grup, tapi sewanya
 * tetap tercatat di database. Di sini kegagalan dikembalikan apa adanya
 * supaya pemanggil bisa membatalkan pencatatan.
 */

/** Ubah pesan error zapo (mis. "... iq failed (401: not-authorized)") jadi penjelasan. */
function jelaskanGagal(pesan) {
  const isi = String(pesan || '').toLowerCase();

  if (isi.includes('not-authorized') || isi.includes('401')) {
    return '_Bot kemungkinan pernah dikeluarkan/diblokir dari grup itu._\n_Solusi: masukkan bot secara manual, lalu ketik *.tambahsewa* di grup tersebut._';
  }
  if (isi.includes('gone') || isi.includes('410')) {
    return '_Link undangan sudah tidak berlaku (direset admin grup)._\n_Minta link yang baru._';
  }
  if (isi.includes('bad-request') || isi.includes('400') || isi.includes('invalid')) {
    return '_Link undangan tidak valid._\n_Pastikan link disalin lengkap._';
  }
  if (isi.includes('forbidden') || isi.includes('403')) {
    return '_Grup menolak bot bergabung (butuh persetujuan admin)._';
  }
  if (isi.includes('resource-limit') || isi.includes('419') || isi.includes('full')) {
    return '_Grup sudah penuh._';
  }
  if (isi.includes('timeout')) {
    return '_Server WhatsApp tidak membalas (timeout). Coba lagi sebentar lagi._';
  }
  return `_Pesan dari server: ${pesan}_`;
}

/**
 * Bergabung ke grup & PASTIKAN bot benar-benar ada di dalamnya.
 *
 * @returns {Promise<{ ok: boolean, jid?: string, sudahAnggota?: boolean, alasan?: string }>}
 */
async function gabungGrupViaLink(sock, kodeInvite) {
  let jid = null;
  let sudahAnggota = false;

  try {
    jid = await sock.groupAcceptInvite(kodeInvite);
  } catch (error) {
    const pesan = String(error?.message || error);

    // Sudah jadi anggota -> bukan kegagalan, sewanya tetap boleh dicatat.
    if (/409|conflict|already/i.test(pesan)) {
      sudahAnggota = true;
    } else {
      return { ok: false, alasan: jelaskanGagal(pesan) };
    }
  }

  return { ok: true, jid, sudahAnggota };
}

/**
 * Cek bot benar-benar anggota grup. Metadata grup hanya bisa diambil kalau
 * bot ada di dalamnya, jadi kegagalannya sekaligus jadi penanda.
 *
 * @returns {Promise<{ ok: boolean, subject?: string, alasan?: string }>}
 */
async function pastikanAnggota(sock, groupJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    if (!metadata?.id && !metadata?.subject) {
      return { ok: false, alasan: '_Bot tidak terdeteksi berada di dalam grup itu._' };
    }
    return { ok: true, subject: metadata.subject };
  } catch (error) {
    return {
      ok: false,
      alasan: `_Bot tidak terdeteksi berada di dalam grup itu._\n${jelaskanGagal(error?.message || error)}`,
    };
  }
}

export { gabungGrupViaLink, pastikanAnggota, jelaskanGagal };
