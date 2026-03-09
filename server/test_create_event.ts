import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

async function main() {
    const prisma = new PrismaClient();
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("no user");

    const secret = process.env.JWT_SECRET || 'dev_secret_please_change';
    const token = jwt.sign({ userId: user.id, role: user.role }, secret, {
        algorithm: 'HS256', expiresIn: '1d'
    });

    const payload: any = {
        title: "Test Event",
        description: "Testing event creation",
        category: "NETWORKING",
        visibility: "PUBLIC",
        startDate: new Date().toISOString()
    };

    // Simulate what CreateEvent.jsx might be omitting (empty tags, guestList etc)
    payload.tags = [];
    payload.guestList = [];
    payload.customSections = [];

    const response = await fetch('http://localhost:3001/api/events', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("STATUS:", response.status);
    console.log("RESPONSE:", JSON.stringify(data, null, 2));
}
main().catch(console.error);
