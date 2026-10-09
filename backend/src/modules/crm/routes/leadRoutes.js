/**
 * @file leadRoutes.js
 * @description Express routes for Lead endpoints.
 */

const express = require('express');
const router = express.Router();
const {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  importLeads
} = require('../controllers/leadController');

router.route('/')
  .get(getLeads)
  .post(createLead);

router.route('/import')
  .post(importLeads);

router.route('/:id')
  .put(updateLead)
  .delete(deleteLead);

module.exports = router;
