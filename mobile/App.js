import { useCallback, useEffect, useMemo, useState } from 'react'
import {
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
import { SITE_URL, supabase } from './lib/supabase'

const ORANGE = '#f35e0e'
const INK = '#1a1a1a'
const MUTED = '#686868'
const FALLBACK_PRODUCTS = [
  { id: 'prod-1', nome: 'Camiseta Algodão Liso Premium', categoria_nome: 'Camisetas', preco_base: 35, imagem: `${SITE_URL}/assets/img/produtos/t-shirt.png` },
  { id: 'prod-4', nome: 'Camisa Polo Tradicional Lisa', categoria_nome: 'Camisetas', preco_base: 55, imagem: `${SITE_URL}/assets/img/produtos/polo-shirt.png` },
  { id: 'prod-8', nome: 'Moletom Canguru Liso Flanelado', categoria_nome: 'Moletons', preco_base: 110, imagem: `${SITE_URL}/assets/img/produtos/foto_do_moleton.png` },
  { id: 'prod-10', nome: 'Caneca Cerâmica Resina Premium 325ml', categoria_nome: 'Canecas', preco_base: 28, imagem: `${SITE_URL}/assets/img/produtos/mug.png` },
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

function ProductCard({ item }) {
  const imageUri = typeof item.imagem === 'string' ? item.imagem : null
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={styles.productCard}
      onPress={() => Linking.openURL(`${SITE_URL}/produto.html?id=${encodeURIComponent(item.id)}`)}
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

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const { data, error } = await supabase.from('produtos').select('id,nome,categoria_id,estilo,preco_base,imagem,descricao,destaque').order('nome')
      if (error || !data?.length) {
        setProducts(FALLBACK_PRODUCTS)
      } else {
        const { data: categories } = await supabase.from('categorias').select('id,nome')
        const categoryNames = new Map((categories || []).map((category) => [String(category.id), category.nome]))
        setProducts(data.map((product) => ({
          ...product,
          categoria_nome: categoryNames.get(String(product.categoria_id)) || 'Produtos',
          imagem: /^https?:\/\//i.test(product.imagem || '') ? product.imagem : `${SITE_URL}/${String(product.imagem || '').replace(/^\//, '')}`,
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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null))
    return () => listener.subscription.unsubscribe()
  }, [loadProducts])

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

  const showCatalog = (category = '') => {
    setActiveCategory(category)
    setSearch('')
    setScreen('catalog')
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
        <TouchableOpacity style={styles.groupButton} onPress={() => Linking.openURL(`${SITE_URL}/pedido-lote.html`)}><Text style={styles.groupButtonText}>MONTAR PEDIDO EM LOTE  →</Text></TouchableOpacity>
        <Image source={require('./assets/camiseta-preta.png')} style={styles.groupImage} resizeMode="contain" />
      </View>

      <View style={styles.section}>
        <SectionHeading eyebrow="ESCOLHIDOS PARA VOCÊ" title="Destaques do catálogo" subtitle="Modelos mais pedidos para congressos e ministérios" />
        {loadingProducts && !featuredProducts.length ? <ActivityIndicator color={ORANGE} style={styles.loader} /> : (
          <View style={styles.productGrid}>{featuredProducts.map((product) => <ProductCard key={product.id} item={product} />)}</View>
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
        <TouchableOpacity style={styles.footerLink} onPress={() => Linking.openURL(SITE_URL)}><Text style={styles.footerLinkText}>VISITAR ROCHA7.DEVS.SURF  ↗</Text></TouchableOpacity>
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
        <FlatList data={filteredProducts} keyExtractor={(item) => String(item.id)} numColumns={2} columnWrapperStyle={styles.productRow} contentContainerStyle={styles.catalogList} renderItem={({ item }) => <ProductCard item={item} />} ListEmptyComponent={<Text style={styles.emptyText}>Nenhum produto encontrado.</Text>} refreshing={loadingProducts} onRefresh={loadProducts} />
      )}
    </View>
  )

  const account = (
    <ScrollView contentContainerStyle={styles.accountContent}>
      <Text style={styles.eyebrow}>ÁREA DO CLIENTE</Text>
      <Text style={styles.accountTitle}>{user ? `Olá, ${user.user_metadata?.nome || user.email?.split('@')[0]}` : authMode === 'login' ? 'Bem-vindo de volta.' : 'Crie sua conta Rocha7.'}</Text>
      <Text style={styles.accountDescription}>Acesse sua conta para acompanhar pedidos e personalizar produtos.</Text>
      {user ? (
        <View style={styles.authCard}><Text style={styles.authLabel}>CONECTADO COMO</Text><Text style={styles.accountEmail}>{user.email}</Text><TouchableOpacity style={styles.accountSubmit} onPress={() => supabase.auth.signOut()}><Text style={styles.accountSubmitText}>SAIR DA CONTA</Text></TouchableOpacity></View>
      ) : (
        <View style={styles.authCard}>
          {authMode === 'cadastro' && <TextInput style={styles.input} placeholder="Seu nome" placeholderTextColor="#888" value={name} onChangeText={setName} autoCapitalize="words" />}
          <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor="#888" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Senha (mínimo 8 caracteres)" placeholderTextColor="#888" value={password} onChangeText={setPassword} secureTextEntry />
          {!!message && <Text style={styles.message}>{message}</Text>}
          <TouchableOpacity style={styles.accountSubmit} onPress={submitAuth} disabled={busy || !email || password.length < 8}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.accountSubmitText}>{authMode === 'login' ? 'ENTRAR NO SISTEMA' : 'CRIAR CONTA'}</Text>}</TouchableOpacity>
          <TouchableOpacity onPress={() => { setAuthMode(authMode === 'login' ? 'cadastro' : 'login'); setMessage('') }}><Text style={styles.switchAuth}>{authMode === 'login' ? 'Não possui uma conta? Cadastre-se aqui' : 'Já possui conta? Entre'}</Text></TouchableOpacity>
        </View>
      )}
      <TouchableOpacity style={styles.profileLink} onPress={() => Linking.openURL(`${SITE_URL}/perfil.html`)}><Text style={styles.allProductsText}>ABRIR PERFIL E PEDIDOS NO SITE  →</Text></TouchableOpacity>
    </ScrollView>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {header}
      <View style={styles.body}>{screen === 'home' ? home : screen === 'catalog' ? catalog : account}</View>
      <View style={styles.bottomBar}>
        {[{ id: 'home', label: 'Início', symbol: '⌂' }, { id: 'catalog', label: 'Catálogo', symbol: '▦' }, { id: 'account', label: 'Minha conta', symbol: '♙' }].map((tab) => (
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
  switchAuth: { textAlign: 'center', color: ORANGE, fontWeight: '700', fontSize: 12, marginTop: 17, padding: 4 },
  message: { color: '#b42318', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  accountEmail: { color: INK, fontSize: 16, marginTop: 8, marginBottom: 18 },
  profileLink: { alignSelf: 'center', padding: 14, marginTop: 12 },
  lightText: { color: '#fff' },
  lightSubtext: { color: '#ccc' },
  lightEyebrow: { color: '#ff985f' },
})
