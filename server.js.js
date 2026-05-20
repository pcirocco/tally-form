import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const {
  PORT = 3000,
  HUBSPOT_PORTAL_ID,
  HUBSPOT_FORM_GUID,
  HUBSPOT_TOKEN,
  TALLY_FORM_URL
} = process.env;

// Map Tally field labels to HubSpot internal property names
const fieldMap = {
  "Email": "email",
  "First name": "firstname",
  "Last name": "lastname",
  "Company": "company",
  "Phone": "phone",
  "Message": "message"
};

app.get("/", (_req, res) => {
  res.send("Tally -> HubSpot webhook is running");
});

app.post("/webhooks/tally", async (req, res) => {
  try {
    const tallyPayload = req.body;
    const tallyFields = tallyPayload?.data?.fields || [];

    const hubspotFields = tallyFields
      .filter((field) => fieldMap[field.label] && field.value !== undefined && field.value !== null && field.value !== "")
      .map((field) => ({
        name: fieldMap[field.label],
        value: Array.isArray(field.value) ? field.value.join("; ") : String(field.value)
      }));

    if (!hubspotFields.length) {
      return res.status(400).json({
        error: "No mappable fields found in Tally payload"
      });
    }

    const submittedAt = tallyPayload?.data?.createdAt
      ? String(new Date(tallyPayload.data.createdAt).getTime())
      : String(Date.now());

    const hubspotPayload = {
      fields: hubspotFields,
      submittedAt,
      context: {
        pageName: tallyPayload?.data?.formName || "Tally form",
        pageUri: TALLY_FORM_URL || "https://tally.so"
      }
    };

    const hubspotUrl =
      `https://api.hsforms.com/submissions/v3/integration/secure/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`;

    const hubspotResponse = await fetch(hubspotUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${HUBSPOT_TOKEN}`
      },
      body: JSON.stringify(hubspotPayload)
    });

    const responseText = await hubspotResponse.text();

    if (!hubspotResponse.ok) {
      return res.status(hubspotResponse.status).json({
        error: "HubSpot submission failed",
        details: responseText
      });
    }

    return res.status(200).json({
      ok: true,
      hubspotResponse: responseText ? JSON.parse(responseText) : {}
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unexpected server error",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});