const express = require("express");
const fs = require("fs");
const path = require("path");
const childProc = require("child_process");
const ip = require("ip");
const Replicate = require("replicate");
const config = require("./config.json");

const PORT = 3000;
const app = express();
const replicate = new Replicate({ auth: config.replicateApiKey });

let currImage = null;

app.use(express.static("./public"));
app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => {
  res.sendFile("./public/index.html");
});

app.post("/uploadImage", (req, res) => {
  let b64Image = req.body.image;
  let question = req.body.question;

  const formData = new FormData();
  formData.append("image", b64Image);

  fetch(
    `https://api.imgbb.com/1/upload?expiration=3600&key=${config.imgbbApiKey}`,
    {
      method: "POST",
      body: formData,
    }
  )
    .then((data) => {
      return data.json();
    })
    .then((json) => {
      if (!json.data) throw "Error";
      currImage = json.data.display_url;
      console.log(currImage);
      return getLLMResponse(question, json.data.display_url);
    })
    .then((llmRes) => {
      res.json({ message: llmRes });
    })
    .catch((err) => {
      res.json({ error: err });
    });
});

app.post("/captureImage", (req, res) => {
  // const curr=parseInt(fs.readFileSync('./pyScripts/num.txt','utf-8'));
  // const upd=curr+1;
  // fs.writeFileSync('num.txt',upd.toString());
  childProc.execSync(`libcamera-jpeg -o ~/Desktop/main101/mpmcPro/images/diseased_leaf_3.jpg`);
  // let images = fs.readdirSync("./images");
  // let latest = images[0];
  // for (let i = 1; i < images.length; i++) {
  //   if (images[i] > latest) latest = images[i];
  // }

  let b64Image = fs.readFileSync(`./images/diseased_leaf_3.jpg`, "base64");
  const formData = new FormData();
  formData.append("image", b64Image);

  fetch(
    `https://api.imgbb.com/1/upload?expiration=3600&key=${config.imgbbApiKey}`,
    {
      method: "POST",
      body: formData,
    }
  )
    .then((data) => {
      return data.json();
    })
    .then((json) => {
      if (!json.data) throw "Error";
      currImage = json.data.display_url;
      console.log(currImage);
      return getLLMResponse(question, json.data.display_url);
    })
    .then((llmRes) => {
      res.json({ message: llmRes });
    })
    .catch((err) => {
      res.json({ error: err });
    });
  // let formData = new FormData();
  // formData.append("image", b64Image);
  // fetch(
  //   `https://api.imgbb.com/1/upload?expiration=3600&key=${config.imgbbApiKey}`,
  //   {
  //     method: "POST",
  //     body: formData,
  //   }
  // )
  //   .then((data) => {
  //     return data.json();
  //   })
  //   .then((json) => {
  //     if (!json.data) throw "Error";
  //     currImage = json.data.display_url;
  //     console.log(currImage);
  //     return getLLMResponse(question,json.data.display_url);
  //   })
  //   .then((llmRes) => {
  //     res.json({ message: llmRes });
  //   })
  //   .catch((err) => {
  //     res.json({ error: err });
  //   });
});

app.post("/getSensor1", (req, res) => {
  promisifyExec("python ./pyScripts/soilmoisture.py")
    .then(({ stdout, stderr }) => {
      res.json({ message: stdout || stderr });
    })
    .catch((err) => {
      res.json({ error: err });
    });
});

app.post("/getSensor2", (req, res) => {
  promisifyExec("python ./pyScripts/Adafruit_Python_DHT/examples/AdafruitDHT.py 2302 4")
    .then(({ stdout, stderr }) => {
      res.json({ message: stdout || stderr });
    })
    .catch((err) => {
      res.json({ error: err });
    });
});

app.get("/latestImage", (req, res) => {
  res.json({ image: currImage });
});

app.listen(PORT, () => {
  console.log(`Listening on http://${ip.address()}:${PORT}/`);
});

/*******************************************************************************************************/

const defaultPrompt =
  "Identify the name of the disease the leaf is suffering from ";
function getLLMResponse(question, imageUrl) {
  return new Promise((resolve, reject) => {
    replicate
      .run(config.modelId, {
        input: {
          prompt: question || defaultPrompt,
          image: imageUrl,
        },
      })
      .then((output) => {
        resolve(output.join(" "));
      })
      .catch(reject);
  });
}

function promisifyExec(cmd) {
  return new Promise((resolve, reject) => {
    childProc.exec(cmd, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}
