/**
 * @file conversationRoutes.js
 * @description API Routes for Team Chat Conversations, Channels & Real-time Messages.
 */

const express = require('express');
const router = express.Router();
const {
  getConversations,
  createConversation,
  sendMessage,
  markAsRead,
  syncBatch,
  updateHuddle,
  sendHuddleSignal,
  getHuddleSignals
} = require('../controllers/conversationController');

router.get('/', getConversations);
router.post('/', createConversation);
router.post('/sync-batch', syncBatch);
router.post('/:id/messages', sendMessage);
router.put('/:id/read', markAsRead);
router.post('/:id/huddle', updateHuddle);
router.post('/:id/huddle/signal', sendHuddleSignal);
router.get('/:id/huddle/signals', getHuddleSignals);

module.exports = router;

