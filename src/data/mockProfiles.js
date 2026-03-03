export const builders = [
    {
        id: 'builder-1',
        name: "Maria Santos",
        company: "Volcano Energy Solutions",
        role: "Founder & CEO",
        bio: "Pioneering renewable energy mining infrastructure. We convert geothermal waste into hashrate.",
        location: "Santa Ana, El Salvador",
        tags: ["Mining", "Energy", "Infrastructure"],
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        nostrNpub: "npub1vhwf...x7p4k",
        experience: [
            {
                title: "Founder & CEO",
                company: "Volcano Energy Solutions",
                date: "2022 - Present",
                description: "Leading the development of sustainable Bitcoin mining operations powered by geothermal energy."
            },
            {
                title: "Senior Energy Engineer",
                company: "CEL El Salvador",
                date: "2018 - 2022",
                description: "Managed grid infrastructure upgrades and renewable energy integration."
            }
        ],
        biesProjects: [
            {
                id: 101,
                name: "Volcano Energy Solutions",
                role: "Founder",
                status: "Active",
                image: "/images/projects/volcano_energy.png"
            },
            {
                id: 102,
                name: "Project Aqua Hash",
                role: "Lead Builder",
                status: "Active",
                image: "/images/projects/aqua_hash.png"
            }
        ],
        notes: [
            {
                id: "n1",
                text: "Just hit a new milestone! Our custom firmware is squeezing out 5% more efficiency from the S19s. #BitcoinMining",
                date: "2h ago",
                likes: 42,
                reposts: 5
            },
            {
                id: "n2",
                text: "Thrilled to see so many new builders arriving in El Salvador. The energy here is unmatched.",
                date: "1d ago",
                likes: 128,
                reposts: 12
            }
        ]
    },
    {
        id: 'builder-2',
        name: "David Li",
        company: "Lightning POS",
        role: "CTO",
        bio: "Building the simplest Point of Sale system for merchants in El Zonte and beyond.",
        location: "El Zonte, La Libertad",
        tags: ["Fintech", "Lightning", "Payments"],
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        nostrNpub: "npub1qxyw...m9a3z",
        experience: [
            {
                title: "CTO",
                company: "Lightning POS",
                date: "2023 - Present",
                description: "Architecting a lightning-fast, offline-capable POS for local merchants."
            },
            {
                title: "Software Engineer",
                company: "Square",
                date: "2019 - 2023",
                description: "Core contributor to the merchants payment processing pipeline."
            }
        ],
        biesProjects: [
            {
                id: 102,
                name: "El Zonte Merchant Kit",
                role: "Creator",
                status: "Seeking Funding"
            }
        ],
        notes: [
            {
                id: "n3",
                text: "Offline async payments with LNURL are going to be a gamechanger for street vendors.",
                date: "5h ago",
                likes: 85,
                reposts: 20
            }
        ]
    },
    // The rest of the mock builders can just have empty arrays so it doesn't break
    {
        id: 'builder-3', name: "Elena Rodriguez", company: "Educación Bitcoin", role: "Director", bio: "Empowering the next generation...", location: "San Salvador", tags: ["Education"], image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", nostrNpub: "npub1...", experience: [], biesProjects: [], notes: []
    },
    {
        id: 'builder-4', name: "Carlos Mendez", company: "AgriBit", role: "Co-Founder", bio: "Tokenizing coffee...", location: "Apaneca", tags: ["Agriculture"], image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", nostrNpub: "npub1...", experience: [], biesProjects: [], notes: []
    },
    {
        id: 'builder-5', name: "Sarah Chen", company: "BitDevs SV", role: "Organizer", bio: "Connecting developers...", location: "San Salvador", tags: ["Developer Tools"], image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", nostrNpub: "npub1...", experience: [], biesProjects: [], notes: []
    }
];

export const investors = [
    {
        id: 'investor-1',
        name: "Freedom Capital",
        company: "Freedom Capital",
        role: "Venture Fund",
        bio: "Early stage Bitcoin-only venture fund focused on emerging markets and freedom tech.",
        location: "San Salvador (HQ)",
        tags: ["Seed", "Series A", "Infrastructure"],
        image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        nostrNpub: "npub1fund...9j2xk",
        experience: [
            {
                title: "Managing Partner",
                company: "Freedom Capital",
                date: "2021 - Present",
                description: "Deploying $50M into early-stage Bitcoin infrastructure startups."
            }
        ],
        biesProjects: [
            {
                id: 101,
                name: "Project Aqua Hash",
                role: "Lead Investor",
                status: "Funded"
            }
        ],
        notes: [
            {
                id: "n4",
                text: "Just deployed capital into an incredible new geothermal mining op. El Salvador is the future.",
                date: "3d ago",
                likes: 240,
                reposts: 55
            }
        ]
    },
    // The rest of the mock investors can just have empty arrays
    {
        id: 'investor-2', name: "Global Macro Ventures", company: "GMV", role: "Family Office", bio: "Allocating capital to hard assets...", location: "New York / El Salvador", tags: ["Real Estate"], image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", nostrNpub: "npub1...", experience: [], biesProjects: [], notes: []
    },
    {
        id: 'investor-3', name: "Lightning Ventures", company: "Lightning Ventures", role: "Angel Syndicate", bio: "Backing the best founders...", location: "Distributed", tags: ["Lightning"], image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", nostrNpub: "npub1...", experience: [], biesProjects: [], notes: []
    },
    {
        id: 'investor-4', name: "El Zonte Capital", company: "El Zonte Capital", role: "Micro VC", bio: "Hyper-local fund...", location: "El Zonte", tags: ["Local Business"], image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", nostrNpub: "npub1...", experience: [], biesProjects: [], notes: []
    },
    {
        id: 'investor-5', name: "Sovereign Wealth", company: "Individual Angel", role: "Angel Investor", bio: "Looking for high-risk...", location: "Bitcoin City", tags: ["Angel"], image: "https://images.unsplash.com/photo-1507679799987-97341b64e727?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", nostrNpub: "npub1...", experience: [], biesProjects: [], notes: []
    }
];
