import Notification from '../models/Notification.js';

export async function notify(userId, title, message, link = '') {
  if (!userId) return;
  try {
    await Notification.create({ user: userId, title, message, link });
  } catch (err) {
    console.error('Notification failed:', err.message);
  }
}
