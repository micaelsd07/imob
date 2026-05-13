const DB_KEY = 'fabelle_imoveis';

const defaultProperties = [
    {
        id: '1',
        title: 'Mansão Horizonte',
        description: 'Uma obra-prima da arquitetura contemporânea com vista panorâmica definitiva. Design minimalista, acabamentos em mármore importado e automação completa.',
        price: 'R$ 15.000.000',
        area: '850m²',
        bedrooms: '5',
        bathrooms: '7',
        parking: '6',
        location: 'Alphaville, SP',
        mainImage: 'imagens/Luxury_house_built_from_start_202605122233_079.jpg',
        features: 'Piscina borda infinita, Home Theater, Adega climatizada, Spa privativo',
        status: 'Disponível'
    },
    {
        id: '2',
        title: 'Residência Aura',
        description: 'Integração perfeita entre natureza e luxo. Pé direito duplo, muita luz natural e materiais orgânicos de altíssimo padrão.',
        price: 'R$ 9.500.000',
        area: '520m²',
        bedrooms: '4',
        bathrooms: '5',
        parking: '4',
        location: 'Fazenda Boa Vista, SP',
        mainImage: 'imagens/Luxury_house_built_from_start_202605122233_050.jpg',
        features: 'Espaço gourmet, Lareira, Sauna, Jardim projetado',
        status: 'Vendido'
    }
];

function initDB() {
    const data = localStorage.getItem(DB_KEY);
    if (!data) {
        localStorage.setItem(DB_KEY, JSON.stringify(defaultProperties));
    }
}

function getProperties() {
    return JSON.parse(localStorage.getItem(DB_KEY)) || [];
}

function getPropertyById(id) {
    const properties = getProperties();
    return properties.find(p => p.id === id);
}

function saveProperty(property) {
    const properties = getProperties();
    if (property.id) {
        const index = properties.findIndex(p => p.id === property.id);
        if (index !== -1) {
            properties[index] = property;
        } else {
            properties.push(property);
        }
    } else {
        property.id = Date.now().toString();
        properties.push(property);
    }
    localStorage.setItem(DB_KEY, JSON.stringify(properties));
}

function deleteProperty(id) {
    let properties = getProperties();
    properties = properties.filter(p => p.id !== id);
    localStorage.setItem(DB_KEY, JSON.stringify(properties));
}

// Initialize on load
initDB();
