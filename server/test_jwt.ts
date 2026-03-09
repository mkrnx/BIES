import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';

async function main() {
    const prisma = new PrismaClient();
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("no user");

    const secret = process.env.JWT_SECRET || 'dev_secret_please_change';
    const token = jwt.sign({ userId: user.id, role: user.role }, secret, {
        algorithm: 'HS256', expiresIn: '1d'
    });

    console.log('TOKEN:', token);
}
main().catch(console.error);
