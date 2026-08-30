import express from 'express';
import asyncHandler from 'express-async-handler';
const router = express.Router();
router.get('/send', asyncHandler((_req, res) => {
    res.send('send a message');
}));
export default router;
//# sourceMappingURL=message.route.js.map