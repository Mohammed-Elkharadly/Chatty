import express from 'express';
import asyncHandler from 'express-async-handler';
const router = express.Router();
router.get('/signup', asyncHandler((_req, res) => {
    res.send('signup');
}));
router.get('/login', asyncHandler((_req, res) => {
    res.send('login');
}));
router.get('/logout', asyncHandler((_req, res) => {
    res.send('logout');
}));
export default router;
//# sourceMappingURL=auth.route.js.map