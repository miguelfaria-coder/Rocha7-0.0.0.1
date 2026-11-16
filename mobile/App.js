import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AppState,
  ActivityIndicator,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { SITE_URL, supabase } from './lib/supabase'

WebBrowser.maybeCompleteAuthSession()

const ORANGE = '#f35e0e'
const INK = '#1a1a1a'
const MUTED = '#686868'
const FALLBACK_PRODUCTS = [
  { id: 'prod-1', nome: 'Camiseta Algodão Liso Premium', categoria_nome: 'Camisetas', preco_base: 35, tipo_personalizacao: 'lisa', cores: ['branco', 'preto', 'cinza', 'azul-marinho'], imagem: `${SITE_URL}/assets/img/produtos/t-shirt.png` },
  { id: 'prod-4', nome: 'Camisa Polo Tradicional Lisa', categoria_nome: 'Camisetas', preco_base: 55, tipo_personalizacao: 'lisa', cores: ['azul-marinho', 'preto', 'branco'], imagem: `${SITE_URL}/assets/img/produtos/polo-shirt.png` },
  { id: 'prod-8', nome: 'Moletom Canguru Liso Flanelado', categoria_nome: 'Moletons', preco_base: 110, tipo_personalizacao: 'lisa', cores: ['preto', 'cinza'], imagem: `${SITE_URL}/assets/img/produtos/foto_do_moleton.png` },
  { id: 'prod-10', nome: 'Caneca Cerâmica Resina Premium 325ml', categoria_nome: 'Canecas', preco_base: 28, tipo_personalizacao: 'personalizavel', cores: ['branco'], imagem: `${SITE_URL}/assets/img/produtos/mug.png` },
]
const CATEGORIES = [
  { id: 'camisa', title: 'Camisetas & Polos', description: 'Camisetas tradicionais e polos em malha fria', image: require('./assets/categoria-camisetas.png') },
  { id: 'moletom', title: 'Moletons', description: 'Canguru flanelado para retiros de inverno', image: require('./assets/categoria-moletons.png') },
  { id: 'caneca', title: 'Canecas', description: 'Cerâmica resinada para presentes e lideranças', image: require('./assets/categoria-canecas.png') },
]
const REVIEWS = [
  { initials: 'PR', name: 'Pr. Roberto Silva', group: 'Igreja Boa Nova (São Paulo)', quote: '“Compramos 85 camisetas para o congresso de jovens. A malha é excelente e chegou antes do prazo.”' },
  { initials: 'LC', name: 'Lidiane Costa', group: 'Líder de Eventos', quote: '“As polos para a equipe de recepção ficaram impecáveis. O bordado veio perfeito.”' },
  { initials: 'MA', name: 'Marcelo & Ana', group: 'Ministério da Família', quote: '“Fizemos moletons para o retiro. O flanelado interno é quentinho. Recomendo demais.”' },
]
const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function SectionHeading({ eyebrow, title, subtitle, light = false }) {
  return (
    <View style={styles.sectionHeading}>
      {!!eyebrow && <Text style={[styles.eyebrow, light && styles.lightEyebrow]}>{eyebrow}</Text>}
      <Text style={[styles.sectionTitle, light && styles.lightText]}>{title}</Text>
      {!!subtitle && <Text style={[styles.sectionSubtitle, light && styles.lightSubtext]}>{subtitle}</Text>}
      <View style={styles.divider} />
    </View>
  )
}

function ProductCard({ item, onPress }) {
  const imageUri = typeof item.imagem === 'string' ? item.imagem : null
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={styles.productCard}
      onPress={onPress}
    >
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="cover" /> : <Image source={item.imagem} style={styles.productImage} resizeMode="cover" />}
      <View style={styles.productInfo}>
        <Text style={styles.productCategory}>{item.categoria_nome || item.categoria || 'Rocha7'}</Text>
        <Text style={styles.productName} numberOfLines={2}>{item.nome}</Text>
        <View style={styles.productBottom}>
          <Text style={styles.productPrice}>{money(item.preco_base ?? item.precoBase)}</Text>
          <Text style={styles.productArrow}>↗</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function NativeField({ label, value, onChangeText, ...props }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={label} placeholderTextColor="#999" {...props} />
    </View>
  )
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeCategory, setActiveCategory] = useState('')
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedColor, setSelectedColor] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedModel, setSelectedModel] = useState('classico')
  const [selectedQuantity, setSelectedQuantity] = useState(10)
  const [editorProduct, setEditorProduct] = useState(null)
  const [designText, setDesignText] = useState('')
  const [designColor, setDesignColor] = useState(ORANGE)
  const [designPlacement, setDesignPlacement] = useState('Frente')
  const [cartItems, setCartItems] = useState(() => {
    try { return JSON.parse(globalThis.localStorage?.getItem('rocha7_mobile_cart_v1') || '[]') } catch { return [] }
  })
  const [checkoutData, setCheckoutData] = useState({ nome: '', email: '', telefone: '', cpf: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '', formaPagamento: 'pix', observacoes: '' })
  const [profileMessage, setProfileMessage] = useState('')
  const [orderMessage, setOrderMessage] = useState('')
  const [orderBusy, setOrderBusy] = useState(false)
  const [lastOrder, setLastOrder] = useState(() => {
    try { return JSON.parse(globalThis.localStorage?.getItem('rocha7_mobile_last_order_v1') || 'null') } catch { return null }
  })
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [bulkProduct, setBulkProduct] = useState(null)
  const [bulkColor, setBulkColor] = useState('')
  const [bulkSize, setBulkSize] = useState('')
  const [bulkModel, setBulkModel] = useState('classico')
  const [bulkQuantity, setBulkQuantity] = useState('10')
  const [bulkItems, setBulkItems] = useState([])
  const [contactForm, setContactForm] = useState({ nome: '', email: '', telefone: '', mensagem: '' })

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const { data, error } = await supabase.from('produtos').select('id,nome,categoria_id,estilo,tipo_personalizacao,preco_base,imagem,descricao,destaque,cores').order('nome')
      if (error || !data?.length) {
        setProducts(FALLBACK_PRODUCTS)
      } else {
        const { data: categories } = await supabase.from('categorias').select('id,nome')
        const categoryNames = new Map((categories || []).map((category) => [String(category.id), category.nome]))
        setProducts(data.map((product) => ({
          ...product,
          categoria_nome: categoryNames.get(String(product.categoria_id)) || 'Produtos',
          imagem: /^https?:\/\//i.test(product.imagem || '') ? product.imagem : `${SITE_URL}/${String(product.imagem || '').replace(/^\//, '')}`,
          cores: Array.isArray(product.cores) ? product.cores : [],
        })).filter((product) => !/baby\s*look/i.test(product.nome || '')))
      }
    } catch (_error) {
      setProducts(FALLBACK_PRODUCTS)
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (!session?.user) {
        setOrders([])
        setCheckoutData({ nome: '', email: '', telefone: '', cpf: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '', formaPagamento: 'pix', observacoes: '' })
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [loadProducts])

  useEffect(() => {
    try { globalThis.localStorage?.setItem('rocha7_mobile_cart_v1', JSON.stringify(cartItems)) } catch {}
  }, [cartItems])

  useEffect(() => {
    if (!user) return
    let active = true
    setCheckoutData((current) => ({ ...current, nome: current.nome || user.user_metadata?.nome || user.user_metadata?.full_name || '', email: current.email || user.email || '' }))
    supabase.from('usuarios').select('nome,email,telefone,cpf,endereco,numero,complemento,bairro,cidade,estado,cep').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (active && data) setCheckoutData((current) => Object.fromEntries(Object.keys(current).map((key) => [key, current[key] || data[key] || ''])))
    })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    const handlePaymentReturn = async (url) => {
      if (!url?.startsWith('rocha7://pagamento-retorno')) return
      const parsed = new URL(url)
      const sessionId = parsed.searchParams.get('session_id')
      const canceled = parsed.searchParams.get('estado') === 'cancelado'
      if (sessionId) {
        const { data } = await supabase.functions.invoke('rocha7-stripe-checkout', { body: { action: 'status', sessionId } })
        setLastOrder((current) => {
          const next = { ...(current || {}), id: data?.pedidoId || current?.id, total: Number(data?.valorTotal ?? current?.total) || 0, status: data?.status || 'pendente', message: data?.status === 'pago' ? 'Pagamento confirmado. Obrigado pela compra!' : 'Pagamento em processamento. A confirmação pode levar alguns instantes.' }
          try { globalThis.localStorage?.setItem('rocha7_mobile_last_order_v1', JSON.stringify(next)) } catch {}
          return next
        })
      } else if (canceled) {
        setLastOrder((current) => current ? { ...current, status: 'cancelado', message: 'Pagamento cancelado. Você pode tentar novamente quando quiser.' } : current)
      }
      setScreen('payment')
    }
    Linking.getInitialURL().then(handlePaymentReturn).catch(() => {})
    const subscription = Linking.addEventListener('url', ({ url }) => { handlePaymentReturn(url).catch(() => {}) })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (!lastOrder?.sessionId || lastOrder.status === 'pago') return
    const checkPayment = async () => {
      const { data } = await supabase.functions.invoke('rocha7-stripe-checkout', { body: { action: 'status', sessionId: lastOrder.sessionId } })
      if (!data) return
      setLastOrder((current) => {
        if (!current) return current
        const next = { ...current, status: data.status || current.status, total: Number(data.valorTotal ?? current.total) || 0, message: data.status === 'pago' ? 'Pagamento confirmado. Obrigado pela compra!' : 'Pagamento em processamento. A confirmação pode levar alguns instantes.' }
        try { globalThis.localStorage?.setItem('rocha7_mobile_last_order_v1', JSON.stringify(next)) } catch {}
        return next
      })
    }
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') checkPayment().catch(() => {}) })
    return () => subscription.remove()
  }, [lastOrder?.sessionId, lastOrder?.status])

  useEffect(() => {
    if (screen !== 'orders' || !user) return
    setOrdersLoading(true)
    supabase.from('pedidos').select('id,status,pagamento_status,valor_total,tipo_pedido,criado_em').eq('usuario_id', user.id).order('criado_em', { ascending: false }).limit(30)
      .then(({ data, error }) => { setOrders(error ? [] : (data || [])); setOrdersLoading(false) })
  }, [screen, user])

  const featuredProducts = useMemo(() => {
    const ids = ['prod-1', 'prod-4', 'prod-8', 'prod-10']
    const featured = ids.map((id) => products.find((product) => String(product.id) === id)).filter(Boolean)
    return featured.length ? featured : products.filter((product) => product.destaque).slice(0, 4)
  }, [products])

  const filteredProducts = useMemo(() => products.filter((product) => {
    const category = String(product.categoria_nome || '').toLowerCase()
    const categoryMatches = !activeCategory || (activeCategory === 'camisa' ? /camisa|polo/i.test(category) : category.includes(activeCategory))
    const searchMatches = !search || `${product.nome} ${category}`.toLowerCase().includes(search.toLowerCase())
    return categoryMatches && searchMatches
  }), [products, activeCategory, search])

  const submitAuth = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = authMode === 'login'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { nome: name.trim() } } })
      if (result.error) setMessage(result.error.message)
      else if (authMode === 'cadastro' && !result.data.session) setMessage('Conta criada. Confirme seu e-mail para entrar.')
      else setMessage('Acesso confirmado. Sua conta é a mesma do site.')
    } catch (_error) {
      setMessage('Não foi possível conectar agora. Confira sua internet e tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const submitGoogleAuth = async () => {
    setBusy(true)
    setMessage('')
    try {
      const redirectTo = 'rocha7://auth-callback'
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })
      if (error) throw error
      if (!data?.url) throw new Error('Não foi possível iniciar o login com Google.')
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type !== 'success' || !result.url) return
      const callbackUrl = new URL(result.url)
      const fragment = new URLSearchParams(callbackUrl.hash.replace(/^#/, ''))
      const code = callbackUrl.searchParams.get('code') || fragment.get('code')
      if (code) {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
        if (sessionError) throw sessionError
      } else {
        const access_token = callbackUrl.searchParams.get('access_token') || fragment.get('access_token')
        const refresh_token = callbackUrl.searchParams.get('refresh_token') || fragment.get('refresh_token')
        if (!access_token || !refresh_token) throw new Error('O Google não concluiu a autenticação. Tente novamente.')
        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
        if (sessionError) throw sessionError
      }
      setMessage('Acesso confirmado. Bem-vindo à Rocha7!')
    } catch (error) {
      setMessage(error?.message || 'Não foi possível entrar com Google. Confira as URLs de redirecionamento do app no Supabase.')
    } finally {
      setBusy(false)
    }
  }

  const showCatalog = (category = '') => {
    setActiveCategory(category)
    setSearch('')
    setScreen('catalog')
  }

  const openProduct = (product) => {
    setSelectedProduct(product)
    setSelectedColor(Array.isArray(product.cores) ? (product.cores[0] || '') : '')
    setSelectedSize('')
    setSelectedModel('classico')
    setSelectedQuantity(10)
    setScreen('product')
  }

  const addCartItem = (product, options) => {
    const key = [product.id, options.tamanho, options.cor, options.modelagem || '', options.tipoPedido || 'varejo', options.customDesign ? JSON.stringify(options.customDesign) : ''].join('_')
    setCartItems((current) => {
      const existing = current.find((item) => item.key === key)
      if (existing) return current.map((item) => item.key === key ? { ...item, quantidade: item.quantidade + options.quantidade } : item)
      return [...current, { key, id: product.id, nome: product.nome, imagem: product.imagem, precoBase: Number(product.preco_base ?? product.precoBase) || 0, tipoPersonalizacao: product.tipo_personalizacao || product.tipoPersonalizacao || 'lisa', categoria: product.categoria_nome || product.categoria || '', ...options }]
    })
  }

  const updateCartQuantity = (key, amount) => setCartItems((current) => current.map((item) => item.key === key ? { ...item, quantidade: Math.max(1, item.quantidade + amount) } : item))
  const removeCartItem = (key) => setCartItems((current) => current.filter((item) => item.key !== key))
  const cartQuantity = cartItems.reduce((sum, item) => sum + item.quantidade, 0)
  const unitPrice = (product, quantity) => {
    const base = Number(product?.preco_base ?? product?.precoBase) || 0
    return (product?.tipo_personalizacao || product?.tipoPersonalizacao) === 'personalizavel' ? Math.round((base + 60 / Math.max(1, quantity)) * 100) / 100 : base
  }
  const cartTotal = cartItems.reduce((sum, item) => sum + (Number(item.precoUnitario) || unitPrice(item, item.quantidade)) * item.quantidade, 0)

  const saveProfile = async () => {
    if (!user) { setProfileMessage('Entre na sua conta para salvar seu perfil.'); return }
    setBusy(true)
    setProfileMessage('')
    const { error } = await supabase.from('usuarios').upsert({ id: user.id, ...Object.fromEntries(Object.entries(checkoutData).filter(([key]) => key !== 'formaPagamento' && key !== 'observacoes')) }, { onConflict: 'id' })
    setBusy(false)
    setProfileMessage(error ? error.message : 'Perfil salvo. Esses dados serão usados no checkout.')
  }

  const submitOrder = async () => {
    const form = checkoutData
    const cpfDigits = form.cpf.replace(/\D/g, '')
    if (cartItems.length === 0) { setOrderMessage('Seu carrinho está vazio.'); return }
    if (form.nome.trim().length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.telefone.replace(/\D/g, '').length < 8 || ![11, 14].includes(cpfDigits.length) || form.cep.replace(/\D/g, '').length !== 8 || !form.endereco.trim() || !form.numero.trim() || !form.bairro.trim() || !form.cidade.trim() || !/^[A-Za-z]{2}$/.test(form.estado.trim())) {
      setOrderMessage('Confira nome, e-mail, telefone, CPF/CNPJ e todos os dados de entrega.'); return
    }
    setOrderBusy(true)
    setOrderMessage('')
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => { const random = Math.random() * 16 | 0; return (char === 'x' ? random : (random & 3 | 8)).toString(16) })
      const order = {
        nome: form.nome.trim(), email: form.email.trim(), telefone: form.telefone.trim(), cpf: form.cpf.trim(),
        endereco: [form.endereco.trim(), `nº ${form.numero.trim()}`, form.complemento.trim(), form.bairro.trim(), `${form.cidade.trim()} - ${form.estado.trim().toUpperCase()}`].filter(Boolean).join(', '),
        cep: form.cep.trim(), formaPagamento: form.formaPagamento, tipoPedido: cartItems.some((item) => item.tipoPedido === 'lote') ? 'lote' : 'varejo', observacoes: form.observacoes.trim(),
      }
      const items = cartItems.map((item) => ({ id: item.id, tamanho: item.tamanho, cor: item.cor, quantidade: item.quantidade, customDesign: item.customDesign || null }))
      const { data: created, error: createError } = await supabase.functions.invoke('rocha7-create-order', { body: { order, items, idempotencyKey } })
      if (createError) throw createError
      if (!created?.pedido?.id) throw new Error(created?.error || 'Não foi possível confirmar o pedido.')
      const { data: checkout, error: paymentError } = await supabase.functions.invoke('rocha7-stripe-checkout', { body: { action: 'create', pedidoId: String(created.pedido.id), idempotencyKey, returnToApp: true } })
      if (paymentError) throw paymentError
      if (!/^https:\/\/checkout\.stripe\.com\//.test(checkout?.url || '')) throw new Error(checkout?.error || 'O pagamento seguro não retornou um endereço válido.')
      const orderReceipt = { id: created.pedido.id, total: Number(created.pedido.valor_total), url: checkout.url, sessionId: checkout.sessionId, status: 'pendente' }
      setLastOrder(orderReceipt)
      try { globalThis.localStorage?.setItem('rocha7_mobile_last_order_v1', JSON.stringify(orderReceipt)) } catch {}
      setCartItems([])
      setScreen('payment')
      await WebBrowser.openAuthSessionAsync(checkout.url, 'rocha7://pagamento-retorno')
    } catch (error) {
      setOrderMessage(error?.message || 'Não foi possível registrar o pedido. Seus itens continuam no carrinho.')
    } finally {
      setOrderBusy(false)
    }
  }

  const submitContact = async () => {
    setBusy(true); setMessage('')
    const { error } = await supabase.functions.invoke('rocha7-contact-message', { body: contactForm })
    setBusy(false)
    setMessage(error ? (error.message || 'Não foi possível enviar sua mensagem.') : 'Mensagem enviada! A equipe Rocha7 entrará em contato.')
    if (!error) setContactForm({ nome: '', email: '', telefone: '', mensagem: '' })
  }

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.brandLockup} onPress={() => setScreen('home')}>
        <Text style={styles.brand}>Rocha7<Text style={styles.brandDot}>.</Text></Text>
        <Text style={styles.tagline}>CAMISETAS, MOLETONS E CANECAS EM LOTE</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.accountButton} onPress={() => setScreen('account')}>
        <Text style={styles.accountGlyph}>♙</Text>
        <Text style={styles.accountButtonText}>{user ? 'Conta' : 'Entrar'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cartHeaderButton} onPress={() => setScreen('cart')}>
        <Text style={styles.cartHeaderGlyph}>▱</Text>
        {cartQuantity > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartQuantity > 99 ? '99+' : cartQuantity}</Text></View>}
      </TouchableOpacity>
    </View>
  )

  const home = (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>PERSONALIZAÇÃO PARA SEU GRUPO</Text>
        <Text style={styles.heroTitle}>Camisetas e uniformes para o seu congresso.</Text>
        <Text style={styles.heroDescription}>A Rocha7 produz camisetas, polos, moletons e canecas com arte própria. Quanto maior o lote da mesma estampa, menor o preço por peça. Venha conhecer e se encantar.</Text>
        <TouchableOpacity style={styles.heroButton} onPress={() => showCatalog()}>
          <Text style={styles.heroButtonText}>VER CATÁLOGO</Text><Text style={styles.heroButtonArrow}>→</Text>
        </TouchableOpacity>
        <Image source={require('./assets/hero-produtos.png')} style={styles.heroImage} resizeMode="contain" />
        <View style={styles.heroContactBar}>
          <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/5511999999999')} style={styles.heroContact}><Text style={styles.contactIcon}>⌕</Text><Text style={styles.contactText}>(11) 99999-9999</Text></TouchableOpacity>
          <View style={styles.contactDivider} />
          <View style={styles.heroContact}><Text style={styles.contactIcon}>⌖</Text><Text style={styles.contactText}>São Paulo - SP</Text></View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading eyebrow="EXPLORE POR CATEGORIA" title="Categorias principais" subtitle="Escolha o produto ideal para o seu evento" />
        <View style={styles.categoryList}>
          {CATEGORIES.map((category) => (
            <TouchableOpacity key={category.id} activeOpacity={0.9} onPress={() => showCatalog(category.id)}>
              <ImageBackground source={category.image} style={styles.categoryCard} imageStyle={styles.categoryImage}>
                <View style={styles.categoryShade} />
                <View style={styles.categoryCopy}>
                  <Text style={styles.categoryTitle}>{category.title}</Text>
                  <Text style={styles.categoryDescription}>{category.description}</Text>
                  <Text style={styles.categoryLink}>EXPLORAR PRODUTOS  →</Text>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.groupSection}>
        <Text style={styles.groupBadge}>PARA IGREJAS E GRUPOS</Text>
        <Text style={styles.groupTitle}>Vai encomendar para mais de 10 pessoas?</Text>
        <Text style={styles.groupDescription}>Quanto mais peças da mesma arte você encomenda, menor fica o valor unitário. O sistema dilui o custo de estampa automaticamente na grade de tamanhos.</Text>
        <View style={styles.benefit}><Text style={styles.check}>✓</Text><Text style={styles.benefitText}>Grade simplificada para vários tamanhos e cores</Text></View>
        <View style={styles.benefit}><Text style={styles.check}>✓</Text><Text style={styles.benefitText}>Diluição automática da estampa no pedido</Text></View>
        <View style={styles.benefit}><Text style={styles.check}>✓</Text><Text style={styles.benefitText}>Atendimento direto para arte e prazos</Text></View>
        <TouchableOpacity style={styles.groupButton} onPress={() => { setBulkProduct(products[0] || null); setBulkItems([]); setScreen('bulk') }}><Text style={styles.groupButtonText}>MONTAR PEDIDO EM LOTE  →</Text></TouchableOpacity>
        <Image source={require('./assets/camiseta-preta.png')} style={styles.groupImage} resizeMode="contain" />
      </View>

      <View style={styles.section}>
        <SectionHeading eyebrow="ESCOLHIDOS PARA VOCÊ" title="Destaques do catálogo" subtitle="Modelos mais pedidos para congressos e ministérios" />
        {loadingProducts && !featuredProducts.length ? <ActivityIndicator color={ORANGE} style={styles.loader} /> : (
          <View style={styles.productGrid}>{featuredProducts.map((product) => <ProductCard key={product.id} item={product} onPress={() => openProduct(product)} />)}</View>
        )}
        <TouchableOpacity style={styles.allProductsButton} onPress={() => showCatalog()}><Text style={styles.allProductsText}>VER CATÁLOGO COMPLETO  →</Text></TouchableOpacity>
      </View>

      <View style={styles.reviewsSection}>
        <SectionHeading eyebrow="QUEM COMPRA, RECOMENDA" title="O que dizem os clientes" subtitle="Igrejas e ministérios que confiam na Rocha7" />
        {REVIEWS.map((review) => (
          <View key={review.initials} style={styles.reviewCard}>
            <Text style={styles.stars}>★★★★★</Text>
            <Text style={styles.reviewQuote}>{review.quote}</Text>
            <View style={styles.reviewAuthor}><View style={styles.reviewAvatar}><Text style={styles.reviewInitials}>{review.initials}</Text></View><View><Text style={styles.reviewName}>{review.name}</Text><Text style={styles.reviewGroup}>{review.group}</Text></View></View>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>Rocha7<Text style={styles.brandDot}>.</Text></Text>
        <Text style={styles.footerText}>Camisetas, moletons e canecas em lote.</Text>
        <TouchableOpacity style={styles.footerLink} onPress={() => setScreen('contact')}><Text style={styles.footerLinkText}>FALE COM A ROCHA7  ↗</Text></TouchableOpacity>
      </View>
    </ScrollView>
  )

  const catalog = (
    <View style={styles.screenFill}>
      <View style={styles.catalogHeading}>
        <Text style={styles.eyebrow}>ROCHA7  /  CATÁLOGO</Text>
        <Text style={styles.catalogTitle}>{activeCategory ? CATEGORIES.find((category) => category.id === activeCategory)?.title || 'Produtos' : 'Nossos produtos'}</Text>
        <Text style={styles.catalogSubtitle}>Peças feitas para o seu grupo, evento ou ministério.</Text>
      </View>
      <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Buscar produtos" placeholderTextColor="#999" style={styles.searchInput} returnKeyType="search" /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
        {[{ id: '', title: 'Todos' }, ...CATEGORIES.map(({ id, title }) => ({ id, title }))].map((category) => (
          <TouchableOpacity key={category.id || 'todos'} onPress={() => setActiveCategory(category.id)} style={[styles.filterChip, activeCategory === category.id && styles.filterChipActive]}><Text style={[styles.filterText, activeCategory === category.id && styles.filterTextActive]}>{category.title}</Text></TouchableOpacity>
        ))}
      </ScrollView>
      {loadingProducts && !products.length ? <ActivityIndicator color={ORANGE} style={styles.loader} /> : (
        <FlatList data={filteredProducts} keyExtractor={(item) => String(item.id)} numColumns={2} columnWrapperStyle={styles.productRow} contentContainerStyle={styles.catalogList} renderItem={({ item }) => <ProductCard item={item} onPress={() => openProduct(item)} />} ListEmptyComponent={<Text style={styles.emptyText}>Nenhum produto encontrado.</Text>} refreshing={loadingProducts} onRefresh={loadProducts} />
      )}
    </View>
  )

  const account = (
    <ScrollView contentContainerStyle={styles.accountContent}>
      <Text style={styles.eyebrow}>ÁREA DO CLIENTE</Text>
      <Text style={styles.accountTitle}>{user ? `Olá, ${user.user_metadata?.nome || user.email?.split('@')[0]}` : authMode === 'login' ? 'Bem-vindo de volta.' : 'Crie sua conta Rocha7.'}</Text>
      <Text style={styles.accountDescription}>Acesse sua conta para acompanhar pedidos e personalizar produtos.</Text>
      {user ? (
        <View style={styles.authCard}>
          <Text style={styles.authLabel}>CONECTADO COMO</Text><Text style={styles.accountEmail}>{user.email}</Text>
          <TouchableOpacity style={styles.accountMenuButton} onPress={() => setScreen('orders')}><Text style={styles.accountMenuText}>Meus pedidos  →</Text></TouchableOpacity>
          <TouchableOpacity style={styles.accountMenuButton} onPress={() => setScreen('profile')}><Text style={styles.accountMenuText}>Dados pessoais e endereço  →</Text></TouchableOpacity>
          <TouchableOpacity style={styles.accountMenuButton} onPress={() => setScreen('contact')}><Text style={styles.accountMenuText}>Falar com atendimento  →</Text></TouchableOpacity>
          <TouchableOpacity style={styles.accountSubmit} onPress={() => supabase.auth.signOut()}><Text style={styles.accountSubmitText}>SAIR DA CONTA</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.authCard}>
          {authMode === 'cadastro' && <TextInput style={styles.input} placeholder="Seu nome" placeholderTextColor="#888" value={name} onChangeText={setName} autoCapitalize="words" />}
          <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor="#888" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Senha (mínimo 8 caracteres)" placeholderTextColor="#888" value={password} onChangeText={setPassword} secureTextEntry />
          {!!message && <Text style={styles.message}>{message}</Text>}
          <TouchableOpacity style={styles.accountSubmit} onPress={submitAuth} disabled={busy || !email || password.length < 8}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.accountSubmitText}>{authMode === 'login' ? 'ENTRAR NO SISTEMA' : 'CRIAR CONTA'}</Text>}</TouchableOpacity>
          <View style={styles.authDivider}><View style={styles.authDividerLine} /><Text style={styles.authDividerText}>OU</Text><View style={styles.authDividerLine} /></View>
          <TouchableOpacity style={styles.googleButton} onPress={submitGoogleAuth} disabled={busy}><Text style={styles.googleMark}>G</Text><Text style={styles.googleButtonText}>CONTINUAR COM GOOGLE</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setAuthMode(authMode === 'login' ? 'cadastro' : 'login'); setMessage('') }}><Text style={styles.switchAuth}>{authMode === 'login' ? 'Não possui uma conta? Cadastre-se aqui' : 'Já possui conta? Entre'}</Text></TouchableOpacity>
        </View>
      )}
      {!user && <TouchableOpacity style={styles.profileLink} onPress={() => setScreen('contact')}><Text style={styles.allProductsText}>PRECISA DE AJUDA? FALE CONOSCO  →</Text></TouchableOpacity>}
    </ScrollView>
  )

  const productCategory = String(selectedProduct?.categoria_nome || '').toLowerCase()
  const offersModel = /camis|camisa|polo/.test(productCategory) || selectedProduct?.estilo === 'polo'
  const productColors = Array.isArray(selectedProduct?.cores) && selectedProduct.cores.length ? selectedProduct.cores : ['Padrão']
  const productSizes = ['PP', 'P', 'M', 'G', 'GG', 'XP', 'XM', 'XG', 'G1', 'G2', 'G3']
  const cartUnitPrice = (item) => {
    if (item.precoUnitario) return Number(item.precoUnitario)
    if (item.tipoPedido === 'lote' && item.tipoPersonalizacao === 'personalizavel') {
      const totalLotQuantity = cartItems.filter((entry) => entry.tipoPedido === 'lote').reduce((sum, entry) => sum + entry.quantidade, 0)
      return Math.round((item.precoBase + 60 / Math.max(totalLotQuantity, 1)) * 100) / 100
    }
    return unitPrice(item, item.quantidade)
  }

  const productDetail = selectedProduct ? (
    <ScrollView contentContainerStyle={styles.detailContent}>
      <TouchableOpacity style={styles.backLink} onPress={() => setScreen('catalog')}><Text style={styles.backLinkText}>←  VOLTAR AO CATÁLOGO</Text></TouchableOpacity>
      <Image source={{ uri: selectedProduct.imagem }} style={styles.detailImage} resizeMode="cover" />
      <Text style={styles.productCategory}>{selectedProduct.categoria_nome || 'PRODUTO ROCHA7'}</Text>
      <Text style={styles.detailTitle}>{selectedProduct.nome}</Text>
      <Text style={styles.detailPrice}>{money(unitPrice(selectedProduct, selectedQuantity))}<Text style={styles.detailUnit}> / un. no lote</Text></Text>
      <Text style={styles.detailHint}>Mínimo de 10 peças. Personalização é recalculada pelo servidor ao fechar o pedido.</Text>
      {!!selectedProduct.descricao && <Text style={styles.detailDescription}>{selectedProduct.descricao}</Text>}
      <Text style={styles.optionLabel}>COR</Text>
      <View style={styles.optionWrap}>{productColors.map((color) => <TouchableOpacity key={color} onPress={() => setSelectedColor(color)} style={[styles.optionChip, selectedColor === color && styles.optionChipActive]}><Text style={[styles.optionChipText, selectedColor === color && styles.optionChipTextActive]}>{color}</Text></TouchableOpacity>)}</View>
      {offersModel && <><Text style={styles.optionLabel}>MODELAGEM</Text><View style={styles.optionWrap}>{[{ id: 'classico', label: 'Clássico' }, { id: 'babyLook', label: 'Baby Look' }].map((model) => <TouchableOpacity key={model.id} onPress={() => setSelectedModel(model.id)} style={[styles.optionChip, selectedModel === model.id && styles.optionChipActive]}><Text style={[styles.optionChipText, selectedModel === model.id && styles.optionChipTextActive]}>{model.label}</Text></TouchableOpacity>)}</View></>}
      <Text style={styles.optionLabel}>TAMANHO</Text>
      <View style={styles.optionWrap}>{productSizes.map((size) => <TouchableOpacity key={size} onPress={() => setSelectedSize(size)} style={[styles.sizeChip, selectedSize === size && styles.optionChipActive]}><Text style={[styles.optionChipText, selectedSize === size && styles.optionChipTextActive]}>{size}</Text></TouchableOpacity>)}</View>
      <View style={styles.quantityRow}><View><Text style={styles.optionLabel}>QUANTIDADE</Text><Text style={styles.detailHint}>Mínimo 10 peças</Text></View><View style={styles.stepper}><TouchableOpacity onPress={() => setSelectedQuantity((value) => Math.max(10, value - 1))}><Text style={styles.stepperButton}>−</Text></TouchableOpacity><Text style={styles.stepperValue}>{selectedQuantity}</Text><TouchableOpacity onPress={() => setSelectedQuantity((value) => value + 1)}><Text style={styles.stepperButton}>＋</Text></TouchableOpacity></View></View>
      <TouchableOpacity style={styles.primaryNativeButton} onPress={() => {
        if (!selectedColor || !selectedSize) { setMessage('Escolha uma cor e um tamanho para continuar.'); return }
        addCartItem(selectedProduct, { tamanho: selectedSize, cor: selectedColor, modelagem: selectedModel, quantidade: selectedQuantity, tipoPedido: 'varejo' })
        setMessage('Produto adicionado ao carrinho.')
      }}><Text style={styles.primaryNativeButtonText}>ADICIONAR AO CARRINHO  ·  {money(unitPrice(selectedProduct, selectedQuantity) * selectedQuantity)}</Text></TouchableOpacity>
      {!!message && <Text style={styles.inlineMessage}>{message}</Text>}
      <TouchableOpacity style={styles.secondaryNativeButton} onPress={() => { setEditorProduct(selectedProduct); setDesignText(''); setDesignPlacement('Frente'); setScreen('editor') }}><Text style={styles.secondaryNativeButtonText}>CRIAR ARTE NO APLICATIVO</Text></TouchableOpacity>
      <TouchableOpacity style={styles.backLink} onPress={() => { setContactForm((current) => ({ ...current, mensagem: `Olá! Gostaria de ajuda com o produto ${selectedProduct.nome}.` })); setScreen('contact') }}><Text style={styles.backLinkText}>PREFIRO PEDIR AJUDA À EQUIPE</Text></TouchableOpacity>
    </ScrollView>
  ) : null

  const editor = editorProduct ? (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backLink} onPress={() => setScreen('product')}><Text style={styles.backLinkText}>←  VOLTAR AO PRODUTO</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>PERSONALIZAÇÃO ROCHA7</Text><Text style={styles.screenTitle}>Crie sua arte</Text>
      <Text style={styles.accountDescription}>Adicione uma frase e escolha onde a equipe deve aplicar a estampa. A prévia é ilustrativa; a arte final é confirmada com você.</Text>
      <ImageBackground source={{ uri: editorProduct.imagem }} style={styles.designPreview} imageStyle={styles.designPreviewImage}>
        <View style={styles.designOverlay}><Text style={[styles.designPreviewText, { color: designColor }]}>{designText.trim() || 'SUA ARTE AQUI'}</Text><Text style={styles.designPositionLabel}>{designPlacement.toUpperCase()}</Text></View>
      </ImageBackground>
      <NativeField label="Texto da estampa" value={designText} onChangeText={setDesignText} maxLength={180} placeholder="Escreva uma frase curta" />
      <Text style={styles.optionLabel}>COR DA ESTAMPA</Text>
      <View style={styles.optionWrap}>{[{ label: 'Laranja', value: ORANGE }, { label: 'Preto', value: '#222222' }, { label: 'Branco', value: '#ffffff' }].map((color) => <TouchableOpacity key={color.value} onPress={() => setDesignColor(color.value)} style={[styles.optionChip, designColor === color.value && styles.optionChipActive]}><Text style={[styles.optionChipText, designColor === color.value && styles.optionChipTextActive]}>{color.label}</Text></TouchableOpacity>)}</View>
      <Text style={styles.optionLabel}>LOCAL DA ESTAMPA</Text>
      <View style={styles.optionWrap}>{['Frente', 'Costas'].map((position) => <TouchableOpacity key={position} onPress={() => setDesignPlacement(position)} style={[styles.optionChip, designPlacement === position && styles.optionChipActive]}><Text style={[styles.optionChipText, designPlacement === position && styles.optionChipTextActive]}>{position}</Text></TouchableOpacity>)}</View>
      <TouchableOpacity style={styles.primaryNativeButton} onPress={() => {
        if (!selectedColor || !selectedSize) { setMessage('Volte ao produto e escolha cor e tamanho antes de adicionar ao pedido.'); return }
        addCartItem(editorProduct, { tamanho: selectedSize, cor: selectedColor, modelagem: selectedModel, quantidade: selectedQuantity, tipoPedido: 'varejo', customDesign: { texto: designText.trim(), cor: designColor, posicao: designPlacement } })
        setMessage('Personalização adicionada ao carrinho.')
        setScreen('cart')
      }}><Text style={styles.primaryNativeButtonText}>GUARDAR ARTE E IR PARA A SACOLA</Text></TouchableOpacity>
      {!!message && <Text style={styles.inlineMessage}>{message}</Text>}
    </ScrollView>
  ) : null

  const cartScreen = (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.eyebrow}>SUA SACOLA</Text><Text style={styles.screenTitle}>Carrinho</Text>
      {!cartItems.length ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Seu carrinho está vazio.</Text><Text style={styles.accountDescription}>Explore o catálogo e adicione peças para continuar.</Text><TouchableOpacity style={styles.primaryNativeButton} onPress={() => showCatalog()}><Text style={styles.primaryNativeButtonText}>EXPLORAR CATÁLOGO</Text></TouchableOpacity></View> : <>
        {cartItems.map((item) => <View key={item.key} style={styles.cartLine}>
          <Image source={{ uri: item.imagem }} style={styles.cartImage} resizeMode="cover" />
          <View style={styles.cartLineBody}><Text style={styles.cartProductName}>{item.nome}</Text><Text style={styles.cartMeta}>{item.cor} · {item.tamanho}{item.modelagem === 'babyLook' ? ' · Baby Look' : ''}</Text>{item.customDesign?.texto ? <Text style={styles.cartMeta}>Arte: “{item.customDesign.texto}” · {item.customDesign.posicao}</Text> : null}<Text style={styles.cartLinePrice}>{money(cartUnitPrice(item))} / un.</Text><View style={styles.cartActions}><View style={styles.stepperSmall}><TouchableOpacity onPress={() => updateCartQuantity(item.key, -1)}><Text style={styles.stepperButton}>−</Text></TouchableOpacity><Text style={styles.stepperValue}>{item.quantidade}</Text><TouchableOpacity onPress={() => updateCartQuantity(item.key, 1)}><Text style={styles.stepperButton}>＋</Text></TouchableOpacity></View><TouchableOpacity onPress={() => removeCartItem(item.key)}><Text style={styles.removeText}>Remover</Text></TouchableOpacity></View></View>
        </View>)}
        <View style={styles.cartSummary}><Text style={styles.summaryLabel}>Subtotal · {cartQuantity} peças</Text><Text style={styles.summaryPrice}>{money(cartItems.reduce((sum, item) => sum + cartUnitPrice(item) * item.quantidade, 0))}</Text><Text style={styles.detailHint}>O valor final é validado no servidor antes da cobrança.</Text><TouchableOpacity style={styles.primaryNativeButton} onPress={() => { setOrderMessage(''); setScreen('checkout') }}><Text style={styles.primaryNativeButtonText}>CONTINUAR PARA ENTREGA E PAGAMENTO  →</Text></TouchableOpacity><TouchableOpacity style={styles.backLink} onPress={() => showCatalog()}><Text style={styles.backLinkText}>CONTINUAR COMPRANDO</Text></TouchableOpacity></View>
      </>}
    </ScrollView>
  )

  const checkout = (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backLink} onPress={() => setScreen('cart')}><Text style={styles.backLinkText}>←  VOLTAR AO CARRINHO</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>FINALIZAR PEDIDO</Text><Text style={styles.screenTitle}>Entrega e pagamento</Text>
      <Text style={styles.formSectionTitle}>Dados para entrega e faturamento</Text>
      {[
        ['nome', 'Nome da pessoa ou organização'], ['email', 'E-mail para confirmação'], ['telefone', 'WhatsApp para contato'], ['cpf', 'CPF ou CNPJ'],
        ['endereco', 'Rua / Avenida'], ['numero', 'Número'], ['complemento', 'Complemento (opcional)'], ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['estado', 'Estado (UF)'], ['cep', 'CEP'],
      ].map(([key, label]) => <NativeField key={key} label={label} value={checkoutData[key]} onChangeText={(value) => setCheckoutData((current) => ({ ...current, [key]: key === 'estado' ? value.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase() : value }))} keyboardType={['telefone', 'cpf', 'cep'].includes(key) ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'} autoCapitalize={key === 'email' ? 'none' : key === 'estado' ? 'characters' : 'words'} />)}
      <Text style={styles.formSectionTitle}>Forma de pagamento preferencial</Text>
      <View style={styles.optionWrap}>{[{ id: 'pix', label: 'PIX' }, { id: 'boleto', label: 'Boleto' }, { id: 'cartao', label: 'Cartão' }].map((pay) => <TouchableOpacity key={pay.id} onPress={() => setCheckoutData((current) => ({ ...current, formaPagamento: pay.id }))} style={[styles.optionChip, checkoutData.formaPagamento === pay.id && styles.optionChipActive]}><Text style={[styles.optionChipText, checkoutData.formaPagamento === pay.id && styles.optionChipTextActive]}>{pay.label}</Text></TouchableOpacity>)}</View>
      <NativeField label="Observações do pedido (opcional)" value={checkoutData.observacoes} onChangeText={(value) => setCheckoutData((current) => ({ ...current, observacoes: value }))} multiline />
      {user && <TouchableOpacity onPress={saveProfile} style={styles.saveProfileButton}><Text style={styles.saveProfileText}>{busy ? 'Salvando dados…' : 'Salvar estes dados no meu perfil'}</Text></TouchableOpacity>}
      {!!orderMessage && <Text style={styles.message}>{orderMessage}</Text>}
      <View style={styles.cartSummary}><Text style={styles.summaryLabel}>Total estimado · {cartQuantity} peças</Text><Text style={styles.summaryPrice}>{money(cartItems.reduce((sum, item) => sum + cartUnitPrice(item) * item.quantidade, 0))}</Text><Text style={styles.detailHint}>A cobrança será feita com segurança pela Stripe. A senha do cartão nunca passa pelo app Rocha7.</Text><TouchableOpacity style={styles.primaryNativeButton} onPress={submitOrder} disabled={orderBusy || !cartItems.length}>{orderBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryNativeButtonText}>REGISTRAR PEDIDO E PAGAR COM SEGURANÇA</Text>}</TouchableOpacity></View>
    </ScrollView>
  )

  const profile = (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backLink} onPress={() => setScreen('account')}><Text style={styles.backLinkText}>←  MINHA CONTA</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>ÁREA DO CLIENTE</Text><Text style={styles.screenTitle}>Meus dados</Text>
      {!user ? <TouchableOpacity style={styles.primaryNativeButton} onPress={() => setScreen('account')}><Text style={styles.primaryNativeButtonText}>ENTRE NA SUA CONTA PARA CONTINUAR</Text></TouchableOpacity> : <>
        {[
          ['nome', 'Nome / organização'], ['email', 'E-mail para pedidos'], ['telefone', 'WhatsApp / telefone'], ['cpf', 'CPF ou CNPJ'], ['endereco', 'Rua / Avenida'], ['numero', 'Número'], ['complemento', 'Complemento'], ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['estado', 'Estado (UF)'], ['cep', 'CEP'],
        ].map(([key, label]) => <NativeField key={key} label={label} value={checkoutData[key]} onChangeText={(value) => setCheckoutData((current) => ({ ...current, [key]: value }))} keyboardType={['telefone', 'cpf', 'cep'].includes(key) ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'} />)}
        {!!profileMessage && <Text style={styles.inlineMessage}>{profileMessage}</Text>}
        <TouchableOpacity style={styles.primaryNativeButton} onPress={saveProfile} disabled={busy}><Text style={styles.primaryNativeButtonText}>{busy ? 'SALVANDO…' : 'SALVAR DADOS DO PERFIL'}</Text></TouchableOpacity>
      </>}
    </ScrollView>
  )

  const orderHistory = (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <TouchableOpacity style={styles.backLink} onPress={() => setScreen('account')}><Text style={styles.backLinkText}>←  MINHA CONTA</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>ÁREA DO CLIENTE</Text><Text style={styles.screenTitle}>Meus pedidos</Text>
      {lastOrder && <View style={styles.orderCard}><Text style={styles.orderNumber}>Pedido #{String(lastOrder.id).slice(0, 8)}</Text><Text style={styles.cartLinePrice}>{money(lastOrder.total)} · {lastOrder.status || 'aguardando pagamento'}</Text>{lastOrder.url && <TouchableOpacity onPress={() => WebBrowser.openAuthSessionAsync(lastOrder.url, 'rocha7://pagamento-retorno')} style={styles.saveProfileButton}><Text style={styles.saveProfileText}>Continuar pagamento seguro  →</Text></TouchableOpacity>}</View>}
      {ordersLoading && <ActivityIndicator color={ORANGE} style={styles.loader} />}
      {!ordersLoading && !user && !lastOrder && <Text style={styles.accountDescription}>Entre na sua conta para consultar seus pedidos.</Text>}
      {!ordersLoading && user && !orders.length && !lastOrder && <Text style={styles.accountDescription}>Nenhum pedido encontrado nesta conta.</Text>}
      {orders.map((order) => <View key={order.id} style={styles.orderCard}><Text style={styles.orderNumber}>Pedido #{String(order.id).slice(0, 8)}</Text><Text style={styles.cartMeta}>{new Date(order.criado_em).toLocaleDateString('pt-BR')} · {order.tipo_pedido === 'lote' ? 'Pedido em lote' : 'Pedido Rocha7'}</Text><Text style={styles.cartLinePrice}>{money(order.valor_total)} · {order.pagamento_status || order.status || 'Em processamento'}</Text></View>)}
      {!!user && !ordersLoading && !orders.length && <Text style={styles.detailHint}>Se seus pedidos não aparecerem, atualize a tela. O acesso é limitado à sua conta.</Text>}
    </ScrollView>
  )

  const payment = (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.eyebrow}>PAGAMENTO SEGURO</Text><Text style={styles.screenTitle}>Seu pedido foi registrado.</Text>
      <Text style={styles.accountDescription}>{lastOrder?.message || 'O pagamento é processado com segurança pela Stripe e o resultado volta para este app.'}</Text>
      {!!lastOrder && <View style={styles.orderCard}><Text style={styles.orderNumber}>Pedido #{String(lastOrder.id).slice(0, 8)}</Text><Text style={styles.summaryPrice}>{money(lastOrder.total)}</Text>{lastOrder.url && lastOrder.status !== 'pago' && <TouchableOpacity style={styles.primaryNativeButton} onPress={() => WebBrowser.openAuthSessionAsync(lastOrder.url, 'rocha7://pagamento-retorno')}><Text style={styles.primaryNativeButtonText}>ABRIR PAGAMENTO SEGURO NOVAMENTE</Text></TouchableOpacity>}</View>}
      <TouchableOpacity style={styles.secondaryNativeButton} onPress={() => setScreen('orders')}><Text style={styles.secondaryNativeButtonText}>VER MEUS PEDIDOS</Text></TouchableOpacity>
      <TouchableOpacity style={styles.backLink} onPress={() => setScreen('home')}><Text style={styles.backLinkText}>VOLTAR AO INÍCIO DO APP</Text></TouchableOpacity>
    </ScrollView>
  )

  const bulk = (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backLink} onPress={() => setScreen('home')}><Text style={styles.backLinkText}>←  INÍCIO</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>PARA IGREJAS E GRUPOS</Text><Text style={styles.screenTitle}>Pedido em lote</Text>
      <Text style={styles.accountDescription}>Monte uma grade com cores e tamanhos diferentes. Pedido mínimo de 10 peças; o preço da estampa é diluído no lote.</Text>
      <Text style={styles.optionLabel}>ESCOLHA UM PRODUTO</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>{products.map((product) => <TouchableOpacity key={product.id} onPress={() => { setBulkProduct(product); setBulkColor(product.cores?.[0] || ''); setBulkSize('') }} style={[styles.optionChip, bulkProduct?.id === product.id && styles.optionChipActive]}><Text style={[styles.optionChipText, bulkProduct?.id === product.id && styles.optionChipTextActive]}>{product.nome}</Text></TouchableOpacity>)}</ScrollView>
      {!!bulkProduct && <>
        <Text style={styles.optionLabel}>COR</Text><View style={styles.optionWrap}>{(bulkProduct.cores?.length ? bulkProduct.cores : ['Padrão']).map((color) => <TouchableOpacity key={color} onPress={() => setBulkColor(color)} style={[styles.optionChip, bulkColor === color && styles.optionChipActive]}><Text style={[styles.optionChipText, bulkColor === color && styles.optionChipTextActive]}>{color}</Text></TouchableOpacity>)}</View>
        <Text style={styles.optionLabel}>TAMANHO</Text><View style={styles.optionWrap}>{productSizes.map((size) => <TouchableOpacity key={size} onPress={() => setBulkSize(size)} style={[styles.sizeChip, bulkSize === size && styles.optionChipActive]}><Text style={[styles.optionChipText, bulkSize === size && styles.optionChipTextActive]}>{size}</Text></TouchableOpacity>)}</View>
        {/camis|camisa|polo/i.test(bulkProduct.categoria_nome || '') && <><Text style={styles.optionLabel}>MODELAGEM</Text><View style={styles.optionWrap}>{[{ id: 'classico', label: 'Clássico' }, { id: 'babyLook', label: 'Baby Look' }].map((model) => <TouchableOpacity key={model.id} onPress={() => setBulkModel(model.id)} style={[styles.optionChip, bulkModel === model.id && styles.optionChipActive]}><Text style={[styles.optionChipText, bulkModel === model.id && styles.optionChipTextActive]}>{model.label}</Text></TouchableOpacity>)}</View></>}
        <NativeField label="Quantidade desta combinação" value={bulkQuantity} onChangeText={setBulkQuantity} keyboardType="number-pad" />
        <TouchableOpacity style={styles.secondaryNativeButton} onPress={() => { if (!bulkColor || !bulkSize || Number(bulkQuantity) < 1) { setMessage('Escolha cor, tamanho e quantidade.'); return }; const key = [bulkProduct.id, bulkSize, bulkColor, bulkModel].join('_'); setBulkItems((current) => { const old = current.find((item) => item.key === key); return old ? current.map((item) => item.key === key ? { ...item, quantidade: item.quantidade + Number(bulkQuantity) } : item) : [...current, { key, product: bulkProduct, cor: bulkColor, tamanho: bulkSize, modelagem: bulkModel, quantidade: Number(bulkQuantity) }] }); setBulkQuantity('1'); setMessage('Combinação adicionada ao lote.') }}><Text style={styles.secondaryNativeButtonText}>ADICIONAR ESTA COMBINAÇÃO  +</Text></TouchableOpacity>
      </>}
      {!!message && <Text style={styles.inlineMessage}>{message}</Text>}
      <Text style={styles.formSectionTitle}>Grade do lote · {bulkItems.reduce((sum, item) => sum + item.quantidade, 0)} peças</Text>
      {bulkItems.map((item) => <View key={item.key} style={styles.bulkLine}><Text style={styles.cartProductName}>{item.product.nome}</Text><Text style={styles.cartMeta}>{item.cor} · {item.tamanho} · {item.modelagem === 'babyLook' ? 'Baby Look' : 'Clássico'}</Text><View style={styles.cartActions}><Text style={styles.cartLinePrice}>{item.quantidade} peças</Text><TouchableOpacity onPress={() => setBulkItems((current) => current.filter((row) => row.key !== item.key))}><Text style={styles.removeText}>Remover</Text></TouchableOpacity></View></View>)}
      <TouchableOpacity style={styles.primaryNativeButton} onPress={() => { const total = bulkItems.reduce((sum, item) => sum + item.quantidade, 0); if (total < 10) { setMessage(`Adicione mais ${10 - total} peças para atingir o mínimo de 10.`); return }; for (const row of bulkItems) addCartItem(row.product, { tamanho: row.tamanho, cor: row.cor, modelagem: row.modelagem, quantidade: row.quantidade, tipoPedido: 'lote' }); setBulkItems([]); setScreen('cart') }}><Text style={styles.primaryNativeButtonText}>LEVAR LOTE PARA O CARRINHO  →</Text></TouchableOpacity>
    </ScrollView>
  )

  const contact = (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backLink} onPress={() => setScreen('home')}><Text style={styles.backLinkText}>←  INÍCIO</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>ATENDIMENTO ROCHA7</Text><Text style={styles.screenTitle}>Como podemos ajudar?</Text>
      {[
        ['nome', 'Seu nome'], ['email', 'Seu e-mail'], ['telefone', 'WhatsApp / telefone'],
      ].map(([key, label]) => <NativeField key={key} label={label} value={contactForm[key]} onChangeText={(value) => setContactForm((current) => ({ ...current, [key]: value }))} keyboardType={key === 'email' ? 'email-address' : key === 'telefone' ? 'phone-pad' : 'default'} />)}
      <NativeField label="Mensagem" value={contactForm.mensagem} onChangeText={(value) => setContactForm((current) => ({ ...current, mensagem: value }))} multiline numberOfLines={5} />
      {!!message && <Text style={styles.inlineMessage}>{message}</Text>}
      <TouchableOpacity style={styles.primaryNativeButton} onPress={submitContact} disabled={busy || !contactForm.nome || !contactForm.email || !contactForm.mensagem}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryNativeButtonText}>ENVIAR MENSAGEM  →</Text>}</TouchableOpacity>
      <TouchableOpacity style={styles.secondaryNativeButton} onPress={() => Linking.openURL('https://wa.me/5511999999999')}><Text style={styles.secondaryNativeButtonText}>CONTINUAR PELO WHATSAPP</Text></TouchableOpacity>
    </ScrollView>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {header}
      <View style={styles.body}>
        {screen === 'home' && home}
        {screen === 'catalog' && catalog}
        {screen === 'account' && account}
        {screen === 'product' && productDetail}
        {screen === 'editor' && editor}
        {screen === 'cart' && cartScreen}
        {screen === 'checkout' && checkout}
        {screen === 'profile' && profile}
        {screen === 'orders' && orderHistory}
        {screen === 'payment' && payment}
        {screen === 'bulk' && bulk}
        {screen === 'contact' && contact}
      </View>
      <View style={styles.bottomBar}>
        {[{ id: 'home', label: 'Início', symbol: '⌂' }, { id: 'catalog', label: 'Catálogo', symbol: '▦' }, { id: 'cart', label: `Sacola${cartQuantity ? ` (${cartQuantity})` : ''}`, symbol: '▱' }, { id: 'account', label: 'Minha conta', symbol: '♙' }].map((tab) => (
          <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => tab.id === 'catalog' ? showCatalog() : setScreen(tab.id)}><Text style={[styles.tabSymbol, screen === tab.id && styles.tabActive]}>{tab.symbol}</Text><Text style={[styles.tabText, screen === tab.id && styles.tabActive]}>{tab.label}</Text></TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  body: { flex: 1 },
  screenFill: { flex: 1, backgroundColor: '#fff' },
  header: { minHeight: 72, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ededed' },
  brandLockup: { justifyContent: 'center' },
  brand: { color: INK, fontSize: 26, lineHeight: 29, fontWeight: '800', letterSpacing: -1.1 },
  brandDot: { color: ORANGE },
  tagline: { color: '#777', fontSize: 8, letterSpacing: 0.55, marginTop: 3 },
  accountButton: { minWidth: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 9, borderColor: '#dedede', borderWidth: 1, borderRadius: 4 },
  accountGlyph: { color: INK, fontSize: 15 },
  accountButtonText: { color: INK, fontSize: 12, fontWeight: '700' },
  cartHeaderButton: { width: 39, height: 39, marginLeft: 9, borderColor: '#dedede', borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  cartHeaderGlyph: { color: INK, fontSize: 21 },
  cartBadge: { position: 'absolute', right: -6, top: -6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: ORANGE },
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  hero: { paddingTop: 30, paddingHorizontal: 22, backgroundColor: '#fff' },
  heroKicker: { color: ORANGE, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 11 },
  heroTitle: { maxWidth: 470, color: INK, fontSize: 36, lineHeight: 39, fontWeight: '800', letterSpacing: -1.4 },
  heroDescription: { color: MUTED, fontSize: 13, lineHeight: 21, marginTop: 14 },
  heroButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: INK, paddingHorizontal: 19, paddingVertical: 14, marginTop: 18, borderRadius: 4 },
  heroButtonText: { color: '#fff', fontSize: 11, letterSpacing: 1.3, fontWeight: '800' },
  heroButtonArrow: { color: '#fff', fontSize: 17 },
  heroImage: { alignSelf: 'center', width: '100%', height: 265, marginTop: 8 },
  heroContactBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#eee', borderBottomWidth: 1, borderBottomColor: '#eee', gap: 15 },
  heroContact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactIcon: { color: INK, fontSize: 17 },
  contactText: { color: '#777', fontSize: 10 },
  contactDivider: { width: 1, height: 16, backgroundColor: '#ddd' },
  section: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 12, backgroundColor: '#fff' },
  sectionHeading: { marginBottom: 21 },
  eyebrow: { color: ORANGE, fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 8 },
  sectionTitle: { color: INK, fontSize: 27, lineHeight: 32, fontWeight: '800', letterSpacing: -0.7 },
  sectionSubtitle: { color: MUTED, fontSize: 13, lineHeight: 20, marginTop: 7 },
  divider: { width: 42, height: 3, backgroundColor: ORANGE, marginTop: 15 },
  categoryList: { gap: 13 },
  categoryCard: { height: 188, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: '#272727' },
  categoryImage: { resizeMode: 'cover' },
  categoryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  categoryCopy: { paddingHorizontal: 18, paddingBottom: 17 },
  categoryTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  categoryDescription: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 4 },
  categoryLink: { color: '#ffb089', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 13 },
  groupSection: { backgroundColor: '#222', paddingHorizontal: 22, paddingTop: 38, paddingBottom: 28, marginTop: 35 },
  groupBadge: { alignSelf: 'flex-start', color: '#fff', backgroundColor: ORANGE, fontSize: 9, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 10, paddingVertical: 7 },
  groupTitle: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.9, marginTop: 15 },
  groupDescription: { color: '#ccc', fontSize: 13, lineHeight: 21, marginTop: 13 },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14 },
  check: { color: ORANGE, fontSize: 16, fontWeight: '800' },
  benefitText: { color: '#eee', fontSize: 12, lineHeight: 18, flex: 1 },
  groupButton: { alignSelf: 'flex-start', backgroundColor: ORANGE, paddingHorizontal: 15, paddingVertical: 13, borderRadius: 4, marginTop: 20 },
  groupButtonText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  groupImage: { width: '100%', height: 210, marginTop: 19 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  productCard: { width: '48.2%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', marginBottom: 13 },
  productImage: { height: 150, width: '100%', backgroundColor: '#f3f3f3' },
  productInfo: { paddingHorizontal: 11, paddingVertical: 12 },
  productCategory: { color: ORANGE, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '800' },
  productName: { color: INK, fontSize: 13, lineHeight: 18, fontWeight: '700', minHeight: 36, marginTop: 5 },
  productBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 },
  productPrice: { color: INK, fontSize: 15, fontWeight: '800' },
  productArrow: { color: ORANGE, fontSize: 17, fontWeight: '700' },
  allProductsButton: { alignSelf: 'center', borderBottomWidth: 1, borderBottomColor: ORANGE, paddingBottom: 5, marginTop: 5, marginBottom: 14 },
  allProductsText: { color: INK, fontSize: 10, letterSpacing: 0.8, fontWeight: '800' },
  reviewsSection: { paddingHorizontal: 20, paddingTop: 37, paddingBottom: 40, backgroundColor: '#f8f9fa' },
  reviewCard: { padding: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', marginBottom: 12 },
  stars: { color: ORANGE, fontSize: 14, letterSpacing: 2 },
  reviewQuote: { color: '#555', fontSize: 13, lineHeight: 21, marginTop: 10 },
  reviewAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 17 },
  reviewAvatar: { width: 36, height: 36, backgroundColor: '#fff2ea', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reviewInitials: { color: ORANGE, fontSize: 11, fontWeight: '800' },
  reviewName: { color: INK, fontSize: 12, fontWeight: '800' },
  reviewGroup: { color: '#888', fontSize: 10, marginTop: 2 },
  footer: { padding: 24, backgroundColor: '#222', alignItems: 'center' },
  footerBrand: { color: '#fff', fontSize: 24, fontWeight: '800' },
  footerText: { color: '#aaa', fontSize: 11, marginTop: 5 },
  footerLink: { borderWidth: 1, borderColor: '#555', paddingHorizontal: 13, paddingVertical: 11, marginTop: 18 },
  footerLinkText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.9 },
  bottomBar: { height: 63, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e8e8e8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 7 },
  tabSymbol: { color: '#777', fontSize: 18, lineHeight: 20 },
  tabText: { color: '#777', fontSize: 10, fontWeight: '600' },
  tabActive: { color: ORANGE, fontWeight: '800' },
  catalogHeading: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 15 },
  catalogTitle: { color: INK, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  catalogSubtitle: { color: MUTED, fontSize: 13, lineHeight: 20, marginTop: 7 },
  searchBox: { height: 46, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingHorizontal: 12 },
  searchIcon: { color: '#555', fontSize: 22, marginRight: 7 },
  searchInput: { flex: 1, color: INK, fontSize: 14, paddingVertical: 9 },
  filterList: { gap: 8, paddingHorizontal: 20, paddingVertical: 15 },
  filterChip: { paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: '#ddd', borderRadius: 2 },
  filterChipActive: { backgroundColor: INK, borderColor: INK },
  filterText: { color: '#555', fontSize: 11, fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  productRow: { justifyContent: 'space-between' },
  catalogList: { paddingHorizontal: 20, paddingBottom: 20 },
  loader: { marginTop: 40 },
  emptyText: { color: MUTED, textAlign: 'center', padding: 30 },
  accountContent: { padding: 22, paddingTop: 30, flexGrow: 1 },
  accountTitle: { color: INK, fontSize: 31, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 },
  accountDescription: { color: MUTED, fontSize: 14, lineHeight: 22, marginTop: 9 },
  authCard: { backgroundColor: '#fff', padding: 18, marginTop: 24, borderWidth: 1, borderColor: '#e8e8e8' },
  authLabel: { color: ORANGE, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  input: { borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12, fontSize: 14, color: INK },
  accountSubmit: { backgroundColor: INK, padding: 15, alignItems: 'center', marginTop: 4 },
  accountSubmitText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  authDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  authDividerLine: { height: 1, flex: 1, backgroundColor: '#e5e5e5' },
  authDividerText: { color: '#888', fontSize: 9, fontWeight: '700' },
  googleButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1, borderColor: '#ccc', marginTop: 14, padding: 11 },
  googleMark: { color: '#4285F4', fontSize: 17, fontWeight: '900' },
  googleButtonText: { color: INK, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  switchAuth: { textAlign: 'center', color: ORANGE, fontWeight: '700', fontSize: 12, marginTop: 17, padding: 4 },
  message: { color: '#b42318', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  accountEmail: { color: INK, fontSize: 16, marginTop: 8, marginBottom: 18 },
  profileLink: { alignSelf: 'center', padding: 14, marginTop: 12 },
  accountMenuButton: { borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 14 },
  accountMenuText: { color: INK, fontSize: 13, fontWeight: '700' },
  detailContent: { padding: 20, paddingBottom: 35 },
  backLink: { alignSelf: 'flex-start', paddingVertical: 12, marginBottom: 5 },
  backLinkText: { color: MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  detailImage: { width: '100%', height: 300, backgroundColor: '#f4f4f4', marginBottom: 20 },
  detailTitle: { color: INK, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.8, marginTop: 5 },
  detailPrice: { color: INK, fontSize: 23, fontWeight: '800', marginTop: 13 },
  detailUnit: { color: MUTED, fontSize: 12, fontWeight: '400' },
  detailHint: { color: MUTED, fontSize: 11, lineHeight: 17, marginTop: 7 },
  detailDescription: { color: '#555', fontSize: 13, lineHeight: 21, marginTop: 14 },
  designPreview: { width: '100%', height: 320, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f4f4', marginTop: 16, overflow: 'hidden' },
  designPreviewImage: { resizeMode: 'contain' },
  designOverlay: { alignItems: 'center', justifyContent: 'center', maxWidth: '66%', padding: 7, backgroundColor: 'rgba(255,255,255,0.74)' },
  designPreviewText: { fontSize: 19, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  designPositionLabel: { color: '#555', fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  optionLabel: { color: INK, fontSize: 10, letterSpacing: 1, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 3 },
  sizeChip: { width: 43, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 3 },
  optionChipActive: { backgroundColor: INK, borderColor: INK },
  optionChipText: { color: '#444', fontSize: 11, fontWeight: '700' },
  optionChipTextActive: { color: '#fff' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 23, marginBottom: 15 },
  stepper: { flexDirection: 'row', minWidth: 120, borderWidth: 1, borderColor: '#ddd', justifyContent: 'space-around', alignItems: 'center' },
  stepperSmall: { flexDirection: 'row', width: 105, borderWidth: 1, borderColor: '#ddd', justifyContent: 'space-around', alignItems: 'center' },
  stepperButton: { color: INK, fontSize: 20, paddingHorizontal: 9, paddingVertical: 4 },
  stepperValue: { color: INK, fontSize: 13, fontWeight: '700' },
  primaryNativeButton: { minHeight: 49, paddingHorizontal: 15, paddingVertical: 14, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', marginTop: 13, borderRadius: 3 },
  primaryNativeButtonText: { color: '#fff', textAlign: 'center', fontSize: 10, fontWeight: '800', letterSpacing: 0.65 },
  secondaryNativeButton: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 3 },
  secondaryNativeButtonText: { color: INK, textAlign: 'center', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  inlineMessage: { color: '#177245', fontSize: 12, textAlign: 'center', marginTop: 13 },
  screenContent: { padding: 20, paddingBottom: 35 },
  screenTitle: { color: INK, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8, marginBottom: 8 },
  emptyCard: { padding: 20, borderWidth: 1, borderColor: '#eee', marginTop: 20 },
  emptyTitle: { color: INK, fontSize: 19, fontWeight: '800' },
  cartLine: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 12 },
  cartImage: { width: 84, height: 92, backgroundColor: '#f3f3f3' },
  cartLineBody: { flex: 1 },
  cartProductName: { color: INK, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  cartMeta: { color: MUTED, fontSize: 11, marginTop: 5 },
  cartLinePrice: { color: INK, fontSize: 12, fontWeight: '700', marginTop: 8 },
  cartActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  removeText: { color: '#9a3b2f', fontSize: 11, fontWeight: '700', padding: 5 },
  cartSummary: { backgroundColor: '#f8f9fa', padding: 17, marginTop: 19 },
  summaryLabel: { color: MUTED, fontSize: 12 },
  summaryPrice: { color: INK, fontSize: 24, fontWeight: '800', marginTop: 5 },
  fieldGroup: { marginTop: 12 },
  fieldLabel: { color: '#444', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  formSectionTitle: { color: INK, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 5 },
  saveProfileButton: { alignSelf: 'flex-start', paddingVertical: 13 },
  saveProfileText: { color: ORANGE, fontSize: 12, fontWeight: '700' },
  orderCard: { padding: 16, borderWidth: 1, borderColor: '#e8e8e8', marginTop: 13 },
  orderNumber: { color: INK, fontSize: 15, fontWeight: '800' },
  bulkLine: { padding: 14, borderWidth: 1, borderColor: '#eee', marginTop: 10 },
  lightText: { color: '#fff' },
  lightSubtext: { color: '#ccc' },
  lightEyebrow: { color: '#ff985f' },
})
