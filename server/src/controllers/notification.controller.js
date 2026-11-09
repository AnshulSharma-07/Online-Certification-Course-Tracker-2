import Notification from '../models/Notification.js';
import { notFound } from '../utils/httpError.js';

export async function listNotifications(req, res) {
  const [notifications, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.json({ notifications, unread });
}

export async function markRead(req, res) {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { readAt: new Date() }, { new: true });
  if (!n) throw notFound('Notification not found');
  res.json({ notification: n });
}

export async function markAllRead(req, res) {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ message: 'All notifications marked as read' });
}
