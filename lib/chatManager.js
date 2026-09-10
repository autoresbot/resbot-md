const chatHistoryMap = new Map();
const totalChat = 20; // jumlah chat yang di simpan sementara, untuk antidelete/antiedit

function addChat(userId, message) {
  const userChatHistory = chatHistoryMap.get(userId) || [];
  userChatHistory.push(message);
  if (userChatHistory.length > totalChat) {
    userChatHistory.shift();
  }
  chatHistoryMap.set(userId, userChatHistory);
}

function getChatHistory(userId) {
  return chatHistoryMap.get(userId) || [];
}

function clearChatHistory(userId) {
  chatHistoryMap.delete(userId);
}

function getAllUsers() {
  return Array.from(chatHistoryMap.keys());
}

function findMessageById(userId, messageId) {
  const userChatHistory = getChatHistory(userId);
  return userChatHistory.find((message) => message.id === messageId) || null;
}

// Fungsi untuk mengedit pesan berdasarkan ID dan sender
function editMessageById(sender, id, newText) {
  const userMessages = chatHistoryMap.get(sender);

  if (!userMessages) {
    throw new Error(`Sender ${sender} tidak ditemukan.`);
  }

  const messageIndex = userMessages.findIndex((msg) => msg.id === id);
  if (messageIndex === -1) {
    throw new Error(
      `Pesan dengan ID ${id} tidak ditemukan untuk sender ${sender}.`
    );
  }

  userMessages[messageIndex].text = newText;
  return userMessages[messageIndex];
}

export {
  addChat,
  getChatHistory,
  clearChatHistory,
  getAllUsers,
  findMessageById,
  editMessageById,
};
