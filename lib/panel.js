import axios from "axios";
import config from "../config.js";
import fs from "fs";

const userDataPath = "./database/additional/user_panel.json";
const serverDataPath = "./database/additional/server_panel.json";

async function panelReady() {
  const { URL, KEY_APPLICATION, SERVER_EGG, id_location } = config.PANEL;
  return Boolean(URL && KEY_APPLICATION && SERVER_EGG && id_location);
}

async function createUser(email, username, password, root_admin = false) {
  if (!email || !username || !password) {
    throw new Error("Email, username dan password tidak boleh kosong");
  }
  const apiUrl = `${config.PANEL.URL}/api/application/users`;
  const data = {
    email: email,
    username: username,
    first_name: username,
    last_name: username,
    password: password,
    root_admin: root_admin,
  };

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.PANEL.KEY_APPLICATION}`,
  };

  try {
    const response = await axios.post(apiUrl, data, { headers });
    return response.data;
  } catch (error) {
    throw error.response
      ? error.response.data
      : new Error("Internal Server Error");
  }
}

async function deleteUser(id_user) {
  const apiUrl = `${config.PANEL.URL}/api/application/users/${id_user}`;
  try {
    const response = await axios.delete(apiUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.PANEL.KEY_APPLICATION}`,
      },
    });
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    throw error.response
      ? error.response.data
      : new Error("Internal Server Error");
  }
}

async function listUser(page = 1) {
  const apiUrl = `${config.PANEL.URL}/api/application/users?page=${page}`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.PANEL.KEY_APPLICATION}`,
  };
  try {
    const response = await axios.get(apiUrl, { headers });
    return response.data;
  } catch (error) {
    throw error.response
      ? error.response.data
      : new Error("Internal Server Error");
  }
}

async function saveUser(filePath = userDataPath) {
  let allUsers = [];
  let currentPage = 1;
  let totalPages = 1;
  try {
    // Iterasi melalui semua halaman
    do {
      const result = await listUser(currentPage);

      if (result.data && result.data.length > 0) {
        allUsers = allUsers.concat(result.data);
        totalPages = result.meta.pagination.total_pages; // Total halaman dari metadata
        currentPage++;
      } else {
        break; // Hentikan loop jika tidak ada data
      }
    } while (currentPage <= totalPages);

    // Simpan data ke file JSON
    fs.writeFileSync(filePath, JSON.stringify(allUsers, null, 2), "utf-8");

    // Kembalikan jumlah total pengguna yang berhasil disimpan
    const totalUsers = allUsers.length;

    // Mengembalikan jumlah total pengguna
    return totalUsers;
  } catch (error) {
    console.error(
      "❌ Terjadi kesalahan saat menyimpan pengguna:",
      error.message
    );
    throw error;
  }
}

async function findUserByEmail(email) {
  try {
    // Cek apakah file JSON ada
    if (!fs.existsSync(userDataPath)) {
      return null;
    }

    // Baca file JSON
    const data = fs.readFileSync(userDataPath, "utf-8");

    // Cek apakah file JSON kosong
    if (!data.trim()) {
      // Memastikan data tidak hanya berisi spasi kosong
      return null;
    }

    // Parse data JSON
    const users = JSON.parse(data);

    // Cari pengguna berdasarkan email
    const user = users.find((u) => u.attributes.email === email); // Sesuaikan dengan struktur data JSON Anda

    // Jika pengguna ditemukan, kembalikan data pengguna
    if (user) {
      return user;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Terjadi kesalahan saat mencari pengguna:", error.message);
    return null;
  }
}

async function saveServer(filePath = serverDataPath) {
  let allServer = [];
  let currentPage = 1;
  let totalPages = 1;
  try {
    // Iterasi melalui semua halaman
    do {
      const result = await listServer(currentPage);

      if (result.data && result.data.length > 0) {
        allServer = allServer.concat(result.data);
        totalPages = result.meta.pagination.total_pages; // Total halaman dari metadata
        currentPage++;
      } else {
        break; // Hentikan loop jika tidak ada data
      }
    } while (currentPage <= totalPages);

    // Simpan data ke file JSON
    fs.writeFileSync(filePath, JSON.stringify(allServer, null, 2), "utf-8");

    // Kembalikan jumlah total pengguna yang berhasil disimpan
    const totalServers = allServer.length;

    // Mengembalikan jumlah total pengguna
    return totalServers;
  } catch (error) {
    console.error("❌ Terjadi kesalahan saat menyimpan server:", error.message);
    throw error;
  }
}

async function listServer(page = 1) {
  const url = `${config.PANEL.URL}/api/application/servers?page=${page}`;
  try {
    const response = await axios.get(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.PANEL.KEY_APPLICATION}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error; // Mengirim error ke pemanggil jika perlu
  }
}

async function createServer(name_server, id_panel, resource) {
  const apiUrl = `${config.PANEL.URL}/api/application/servers`;
  const data = {
    name: name_server,
    user: id_panel,
    egg: config.PANEL.SERVER_EGG,
    docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
    startup:
      'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi;  if [[ ! -z ${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then      vars=$(echo ${CUSTOM_ENVIRONMENT_VARIABLES} | tr ";" "\\n");      for line in $vars;     do export $line;     done fi;  /usr/local/bin/${CMD_RUN};',
    environment: {
      INST: "npm",
      USER_UPLOAD: "0",
      AUTO_UPDATE: "0",
      CMD_RUN: "npm start",
      JS_FILE: "index.js",
      P_SERVER_ALLOCATION_LIMIT: "0",
    },
    limits: resource,
    feature_limits: {
      databases: 0,
      backups: 0,
      allocations: 0,
    },
    description: config.PANEL.description,
    deploy: {
      locations: [config.PANEL.id_location],
      dedicated_ip: false,
      port_range: ["0-1000000000"],
    },
    allocation: {
      default: 1,
    },
    start_on_completion: true,
    skip_scripts: false,
    oom_disabled: true,
  };

  try {
    const response = await axios.post(apiUrl, data, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.PANEL.KEY_APPLICATION}`,
      },
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    throw error.response
      ? error.response.data
      : new Error("Internal Server Error");
  }
}

async function deleteServer(idserver) {
  const apiUrl = `${config.PANEL.URL}/api/application/servers/${idserver}/force`;
  try {
    const response = await axios.delete(apiUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.PANEL.KEY_APPLICATION}`,
      },
    });
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    // Handle error
    throw error.response
      ? error.response.data
      : new Error("Internal Server Error");
  }
}

async function UpdateUser(userId, email, username, newPassword) {
  const apiUrl = `${config.PANEL.URL}/api/application/users/${userId}`;
  const data = {
    email: email,
    username: username,
    first_name: username,
    last_name: username,
    language: "en",
    password: newPassword,
  };

  try {
    const response = await axios.patch(apiUrl, data, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.PANEL.KEY_APPLICATION}`,
      },
      withCredentials: true,
    });

    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : "Internal Server Error";
  }
}

async function getServerFilter(page, uuid) {
  const url = `${config.PANEL.URL}/api/application/servers?per_page=${page}&filter[uuid]=${uuid}`;
  try {
    const response = await axios.get(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.PANEL.KEY_APPLICATION}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error; // Mengirim error ke pemanggil jika perlu
  }
}

async function getServerByUUID(uuid) {
  const url = `${config.PANEL.URL}/api/application/servers?per_page=10&filter[uuid]=${uuid}`;
  try {
    const response = await axios.get(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.PANEL.KEY_APPLICATION}`,
      },
    });
    return response.data.data;
  } catch (error) {
    throw error; // Mengirim error ke pemanggil jika perlu
  }
}
export {
  createUser,
  listServer,
  listUser,
  saveUser,
  deleteServer,
  deleteUser,
  findUserByEmail,
  createServer,
  panelReady,
  saveServer,
};
