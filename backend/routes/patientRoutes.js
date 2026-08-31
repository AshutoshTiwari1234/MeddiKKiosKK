const express = require("express");
const router = express.Router();

const {
    createPatient,
    getAllPatients,
    getPatientById,
    updatePatient
} = require("../controllers/patientController");
router.post("/", createPatient);
router.put("/:id", updatePatient);
router.get("/", getAllPatients);
router.get("/:id", getPatientById);

module.exports = router;