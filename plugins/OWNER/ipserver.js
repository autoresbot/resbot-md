import axios from "axios";

/**
 * Checks IPv4 and IPv6 addresses with a timeout of 15 seconds.
 * @returns {Promise<string>} The response message containing IPv4 and IPv6 details.
 */
const checkIPs = async () => {
  try {
    const timeout = 15000; // Timeout in milliseconds

    // Check IPv4
    const ipv4Response = await axios.get("https://api.ipify.org", { timeout });
    const ipv4 = ipv4Response.data.trim();

    // Check IPv6
    let ipv6 = "Not Supported";
    try {
      const ipv6Response = await axios.get("https://api6.ipify.org", {
        timeout,
      });
      ipv6 = ipv6Response.data.trim();
    } catch (error) {
      console.warn(`Failed to fetch IPv6: ${error.message}`);
    }

    // Prepare response
    return `_IP SERVER_
IPv4: ${ipv4}
IPv6: ${ipv6}`;
  } catch (error) {
    return `Gagal Saat Mengecek IP: ${error.message}`;
  }
};

/**
 * Handles the "ipserver" command.
 * @param {object} sock - The socket connection object.
 * @param {object} messageInfo - Information about the incoming message.
 */
async function handle(sock, messageInfo) {
  const { m, remoteJid, message } = messageInfo;

  try {
    // Send a loading reaction
    await sock.sendMessage(remoteJid, {
      react: { text: "⏰", key: message.key },
    });

    // Fetch IP details
    const response = await checkIPs();

    // Send the IP details as a message
    await sock.sendMessage(remoteJid, { text: response }, { quoted: message });
  } catch (error) {
    // Handle errors
    console.error("Error in handle function:", error);
    const errorMessage = `Maaf, terjadi kesalahan saat memproses permintaan Anda. Coba lagi nanti.

Detail Kesalahan: ${error.message}`;
    await sock.sendMessage(
      remoteJid,
      { text: errorMessage },
      { quoted: message }
    );
  }
}

export default {
  handle,
  Commands: ["ipserver"],
  OnlyPremium: false,
  OnlyOwner: true,
};
