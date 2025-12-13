import type { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from './youtubeUploader';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email?: string;
    };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        const payload = await verifyIdToken(token);

        if (!payload || !payload.sub) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }

        (req as AuthenticatedRequest).user = {
            id: payload.sub,
            email: payload.email
        };

        next();
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
}
