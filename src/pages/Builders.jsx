import React from 'react';
import { Hammer, Search, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { builders } from '../data/mockProfiles';

const Builders = () => {
    return (
        <div className="container py-12">
            <div className="flex flex-col items-center text-center mb-12">
                <div className="icon-wrapper mb-4">
                    <Hammer size={48} className="text-primary" />
                </div>
                <h1>Builders Directory</h1>
                <p className="text-lg text-gray-500 max-w-2xl mt-4">
                    Discover the visionaries building the infrastructure of freedom in El Salvador.
                </p>

                <div className="search-bar mt-8">
                    <Search size={20} className="text-gray-400" />
                    <input type="text" placeholder="Search builders..." />
                </div>
            </div>

            <div className="builders-grid">
                {builders.map((builder) => (
                    <Link to={`/builder/${builder.id}`} key={builder.id} className="card-link">
                        <div className="card">
                            <div className="h-48 bg-gray-100 relative">
                                <img src={builder.image} alt={builder.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black bg-opacity-10 hover:bg-opacity-0 transition-all"></div>
                            </div>
                            <div className="p-5">
                                <h3 className="font-semibold text-xl mb-1">{builder.name}</h3>
                                <p className="text-primary font-medium text-sm mb-2">{builder.company}</p>
                                <p className="text-sm text-gray-500 line-clamp-2 mb-4">{builder.bio}</p>

                                <div className="flex flex-wrap gap-2 mt-auto">
                                    {builder.tags.map((tag, i) => (
                                        <span key={i} className="tag">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            <style jsx>{`
                .builders-grid {
                    display: grid;
                    gap: 2rem;
                    grid-template-columns: repeat(1, 1fr);
                }

                @media (min-width: 640px) {
                    .builders-grid { grid-template-columns: repeat(2, 1fr); }
                }

                @media (min-width: 1024px) {
                    .builders-grid { grid-template-columns: repeat(3, 1fr); }
                }

                @media (min-width: 1280px) {
                    .builders-grid { grid-template-columns: repeat(4, 1fr); }
                }

                .h-48 { height: 12rem; }
                .bg-gray-100 { background: var(--color-gray-100); }
                .text-gray-400 { color: var(--color-gray-400); }
                .object-cover { object-fit: cover; }
                .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
                .bg-black { background-color: black; }
                .bg-opacity-10 { background-color: rgba(0,0,0,0.1); }

                .icon-wrapper {
                    padding: 1.5rem;
                    background: rgba(0, 71, 171, 0.1);
                    border-radius: 50%;
                    width: fit-content;
                }
                
                .search-bar {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    background: white;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-full);
                    width: 100%;
                    max-width: 400px;
                    box-shadow: var(--shadow-sm);
                }
                .search-bar input {
                    border: none;
                    outline: none;
                    width: 100%;
                    font-size: 1rem;
                }

                .card {
                    background: white;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    transition: transform 0.2s, box-shadow 0.2s;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
                .card-link { display: block; text-decoration: none; color: inherit; height: 100%; }

                .tag {
                    font-size: 0.75rem;
                    padding: 2px 10px;
                    background: var(--color-gray-100);
                    border-radius: 99px;
                    color: var(--color-gray-600);
                    font-weight: 500;
                }
                
                .line-clamp-2 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
            `}</style>
        </div>
    );
};

export default Builders;
