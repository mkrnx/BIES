import React from 'react';
import { useTranslation } from 'react-i18next';

const Team = () => {
    const { t } = useTranslation();

    return (
        <div className="about-page">
            {/* Mission */}
            <section className="mission-section">
                <div className="container text-center">
                    <h1 className="mb-4 page-header">{t('team.title')}</h1>
                    <p className="lead">{t('team.missionLead')}</p>
                    <p className="lead">{t('team.missionBody')}</p>
                </div>
            </section>

            <style jsx>{`
        .mission-section {
          padding: 6rem 0;
          background: var(--color-neutral-light);
        }
        .lead {
          font-size: 1.25rem;
          color: var(--color-gray-500);
          max-width: 800px;
          margin: 0 auto;
          line-height: 1.8;
        }

        .mission-section .lead + .lead {
          margin-top: 1.25rem;
        }

        @media (max-width: 768px) {
          .page-header { display: none !important; }
        }
      `}</style>
        </div>
    );
};

export default Team;
