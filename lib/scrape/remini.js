import axios from "axios";
import FormData from "form-data";

// ReminiV1 function
async function ReminiV1(buffer) {
  try {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Input must be a Buffer.");
    }

    const formData = new FormData();
    formData.append("image", buffer, {
      filename: "enhance_image_body.jpg",
      contentType: "image/jpeg",
    });
    formData.append("model_version", 1);

    const response = await axios.post(
      "https://inferenceengine.vyro.ai/enhance.vyro",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "User-Agent": "okhttp/4.9.3",
          Connection: "Keep-Alive",
          "Accept-Encoding": "gzip",
        },
        responseType: "arraybuffer",
        timeout: 40000,
      }
    );
    return Buffer.from(response.data);
  } catch (error) {
    throw error;
  }
}

// ReminiV2 function
async function ReminiV2(buffer) {
  try {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Input must be a Buffer.");
    }

    const formData = new FormData();
    formData.append("image", buffer, { filename: "image.jpg" });
    formData.append("scale", 2);

    // Step 1: Send request to the API to process the image
    const response = await axios.post(
      "https://api2.pixelcut.app/image/upscale/v1",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Accept: "application/json",
        },
      }
    );

    const imageUrl = response.data.result_url;
    if (!imageUrl) {
      throw new Error("Failed to get the image URL.");
    }

    // Step 2: Download the processed image
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    return Buffer.from(imageResponse.data);
  } catch (error) {
    throw error;
  }
}

export { ReminiV1, ReminiV2 };
