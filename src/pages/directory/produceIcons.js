import {
    Beef, Egg, Milk, Droplets, Carrot, Coffee, Hexagon, Drumstick, Leaf,
} from 'lucide-react';

/**
 * Produce icon mapping for directory listings.
 *
 * Products are stored as [{ label, icon }] where `icon` is an optional key
 * from PRODUCE_ICONS. When no key is set (or it is unknown), the label is
 * matched against keywords (EN + ES) so free-text products still get a
 * sensible icon. Falls back to Leaf.
 */

export const PRODUCE_ICONS = {
    beef: Beef,
    egg: Egg,
    milk: Milk,
    tallow: Droplets,
    vegetable: Carrot,
    coffee: Coffee,
    honey: Hexagon,
    chicken: Drumstick,
    leaf: Leaf,
};

export const PRODUCE_ICON_KEYS = Object.keys(PRODUCE_ICONS);

const KEYWORD_RULES = [
    { icon: Beef, keywords: ['beef', 'meat', 'steak', 'pork', 'lamb', 'carne', 'res', 'cerdo'] },
    { icon: Egg, keywords: ['egg', 'huevo'] },
    { icon: Milk, keywords: ['milk', 'dairy', 'cheese', 'yogurt', 'leche', 'queso', 'lacteo'] },
    { icon: Droplets, keywords: ['tallow', 'oil', 'fat', 'ghee', 'sebo', 'aceite', 'manteca'] },
    { icon: Carrot, keywords: ['vegetable', 'veggie', 'herb', 'greens', 'produce', 'fruit', 'verdura', 'hortaliza', 'hierba', 'fruta'] },
    { icon: Coffee, keywords: ['coffee', 'cafe'] },
    { icon: Hexagon, keywords: ['honey', 'miel'] },
    { icon: Drumstick, keywords: ['chicken', 'poultry', 'turkey', 'pollo', 'ave', 'pavo'] },
];

/**
 * Resolve the lucide icon component for a product.
 * @param {string|{label?: string, icon?: string}} product
 * @returns {import('lucide-react').LucideIcon}
 */
export function getProduceIcon(product) {
    if (!product) return Leaf;

    const iconKey = typeof product === 'object' ? product.icon : null;
    if (iconKey && PRODUCE_ICONS[String(iconKey).toLowerCase()]) {
        return PRODUCE_ICONS[String(iconKey).toLowerCase()];
    }

    const label = (typeof product === 'string' ? product : product.label || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // strip accents so "café" matches "cafe"

    for (const rule of KEYWORD_RULES) {
        if (rule.keywords.some((k) => label.includes(k))) return rule.icon;
    }
    return Leaf;
}
