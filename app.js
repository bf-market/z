// Configuration Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Initialisation Stripe
const stripe = Stripe('YOUR_STRIPE_PUBLIC_KEY');

// Données de l'application
let products = [];
let cart = [];
let tvChannels = [];

// Chargement initial
document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    await loadTVChannels();
    loadDailyQuote();
    renderCart();
    
    // Gestionnaire de paiement
    document.getElementById('checkout-button').addEventListener('click', checkout);
});

// Charger les produits depuis Firestore
async function loadProducts() {
    const snapshot = await db.collection('products').get();
    products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderProducts();
}

// Afficher les produits
function renderProducts() {
    const container = document.getElementById('products-container');
    container.innerHTML = products.map(product => `
        <div class="border rounded overflow-hidden hover:shadow-lg transition-shadow">
            <img src="${product.imageUrl}" alt="${product.name}" class="w-full h-48 object-cover">
            <div class="p-4">
                <h3 class="font-semibold">${product.name}</h3>
                <p class="text-gray-600 text-sm my-2">${product.description}</p>
                <div class="flex justify-between items-center mt-3">
                    <span class="font-bold">€${product.price.toFixed(2)}</span>
                    <button onclick="addToCart('${product.id}')" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                        Ajouter
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Gestion du panier
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    
    if (cart.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Votre panier est vide</p>';
        totalElement.textContent = 'Total: €0.00';
        return;
    }
    
    container.innerHTML = cart.map(item => `
        <div class="flex justify-between items-center border-b py-2">
            <span>${item.name} x${item.quantity}</span>
            <span>€${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalElement.textContent = `Total: €${total.toFixed(2)}`;
}

// Paiement avec Stripe
async function checkout() {
    if (cart.length === 0) return;
    
    const lineItems = cart.map(item => ({
        price_data: {
            currency: 'eur',
            product_data: {
                name: item.name,
            },
            unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
    }));
    
    try {
        const response = await fetch('https://your-stripe-endpoint.vercel.app/api/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lineItems }),
        });
        
        const { sessionId } = await response.json();
        await stripe.redirectToCheckout({ sessionId });
    } catch (error) {
        console.error('Erreur lors du paiement:', error);
    }
}

// Charger les chaînes TV
async function loadTVChannels() {
    const snapshot = await db.collection('tv-channels').get();
    tvChannels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderTVChannels();
}

// Afficher les chaînes TV
function renderTVChannels() {
    const container = document.getElementById('tv-container');
    container.innerHTML = tvChannels.map(channel => `
        <div class="border rounded overflow-hidden">
            <div class="relative pt-[56.25%]">
                <video id="player-${channel.id}" class="video-js absolute top-0 left-0 w-full h-full" controls></video>
            </div>
            <div class="p-3 bg-gray-50">
                <h3 class="font-semibold">${channel.name}</h3>
                <p class="text-sm text-gray-600">${channel.category}</p>
            </div>
        </div>
    `).join('');
    
    // Initialiser les lecteurs HLS
    tvChannels.forEach(channel => {
        const video = document.getElementById(`player-${channel.id}`);
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(channel.streamUrl);
            hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = channel.streamUrl;
        }
    });
}

// Charger une citation aléatoire
async function loadDailyQuote() {
    try {
        const response = await fetch('https://api.quotable.io/random');
        const data = await response.json();
        document.getElementById('daily-quote').innerHTML = `
            <p class="italic text-lg">"${data.content}"</p>
            <p class="text-right mt-2 font-medium">— ${data.author}</p>
        `;
    } catch (error) {
        console.error('Erreur lors du chargement de la citation:', error);
        document.getElementById('daily-quote').innerHTML = `
            <p class="text-red-500">Impossible de charger la citation du jour</p>
        `;
    }
}

// Fonction de recherche (pour Alpine.js)
document.addEventListener('alpine:init', () => {
    Alpine.data('search', () => ({
        searchQuery: '',
        showResults: false,
        filteredItems: [],
        
        init() {
            this.$watch('searchQuery', value => {
                if (value.length > 2) {
                    this.filteredItems = [...products, ...tvChannels]
                        .filter(item => item.name.toLowerCase().includes(value.toLowerCase()))
                        .slice(0, 5);
                } else {
                    this.filteredItems = [];
                }
            });
        }
    }));
});
