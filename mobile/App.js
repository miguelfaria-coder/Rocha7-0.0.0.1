import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
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

const BRAND = '#a91f2c'
const FALLBACK_PRODUCTS = [
  { id: 'prod-1', nome: 'Camiseta Algodão Liso Premium', categoria_nome: 'Camisetas', preco_base: 35, imagem: `${SITE_URL}/assets/img/produtos/t-shirt.png` },
  { id: 'prod-4', nome: 'Camisa Polo Tradicional Lisa', categoria_nome: 'Camisetas', preco_base: 55, imagem: `${SITE_URL}/assets/img/produtos/polo-shirt.png` },
  { id: 'prod-8', nome: 'Moletom Canguru Liso Flanelado', categoria_nome: 'Moletons', preco_base: 110, imagem: `${SITE_URL}/assets/img/produtos/foto_do_moleton.png` },
  { id: 'prod-10', nome: 'Caneca Cerâmica Resina Premium', categoria_nome: 'Canecas', preco_base: 28, imagem: `${SITE_URL}/assets/img/produtos/mug.png` },
]

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function App() {
  const [screen, setScreen] = useState('catalog')
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    const { data, error } = await supabase.from('produtos').select('id,nome,categoria_id,preco_base,imagem,descricao').order('nome')
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
    setLoadingProducts(false)
  }, [])

  useEffect(() => {
    loadProducts()
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null))
    return () => listener.subscription.unsubscribe()
  }, [loadProducts])

  const submitAuth = async () => {
    setBusy(true)
    setMessage('')
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { nome: name.trim() } } })
    setBusy(false)
    if (result.error) setMessage(result.error.message)
    else if (authMode === 'cadastro' && !result.data.session) setMessage('Conta criada. Confirme seu e-mail para entrar.')
    else setMessage('Acesso confirmado. Sua conta é a mesma do site.')
  }

  const ProductCard = ({ item }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.imagem }} style={styles.productImage} resizeMode="cover" />
      <View style={styles.cardBody}>
        <Text style={styles.category}>{item.categoria_nome}</Text>
        <Text style={styles.productName} numberOfLines={2}>{item.nome}</Text>
        <Text style={styles.price}>{money(item.preco_base)}</Text>
        <TouchableOpacity style={styles.outlineButton} onPress={() => Linking.openURL(`${SITE_URL}/produto.html?id=${encodeURIComponent(item.id)}`)}>
          <Text style={styles.outlineButtonText}>Ver produto no site</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f6f2" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>ROCHA<Text style={styles.brandAccent}>7</Text></Text>
          <Text style={styles.tagline}>Vista sua fé. Vista sua equipe.</Text>
        </View>
        <TouchableOpacity style={styles.accountButton} onPress={() => setScreen(screen === 'account' ? 'catalog' : 'account')}>
          <Text style={styles.accountButtonText}>{user ? 'Minha conta' : 'Entrar'}</Text>
        </TouchableOpacity>
      </View>

      {screen === 'catalog' ? (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ProductCard item={item} />}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.catalogContent}
          onRefresh={loadProducts}
          refreshing={loadingProducts}
          ListHeaderComponent={<View style={styles.intro}><Text style={styles.eyebrow}>CATÁLOGO ROCHA7</Text><Text style={styles.title}>Feito para vestir seus momentos.</Text><Text style={styles.subtitle}>Os mesmos produtos e preços disponíveis no nosso site.</Text></View>}
          ListEmptyComponent={loadingProducts ? <ActivityIndicator color={BRAND} style={{ marginTop: 40 }} /> : null}
          ListFooterComponent={<TouchableOpacity style={styles.siteButton} onPress={() => Linking.openURL(SITE_URL)}><Text style={styles.siteButtonText}>Acessar o site completo</Text></TouchableOpacity>}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.accountContent}>
          <Text style={styles.eyebrow}>CONTA ROCHA7</Text>
          <Text style={styles.title}>{user ? `Olá, ${user.user_metadata?.nome || user.email?.split('@')[0]}` : authMode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</Text>
          <Text style={styles.subtitle}>Use a mesma conta do site para acompanhar sua experiência.</Text>
          {user ? (
            <View style={styles.authCard}>
              <Text style={styles.accountEmail}>{user.email}</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => supabase.auth.signOut()}><Text style={styles.primaryButtonText}>Sair da conta</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.authCard}>
              {authMode === 'cadastro' && <TextInput style={styles.input} placeholder="Seu nome" value={name} onChangeText={setName} autoCapitalize="words" />}
              <TextInput style={styles.input} placeholder="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <TextInput style={styles.input} placeholder="Senha (mínimo 8 caracteres)" value={password} onChangeText={setPassword} secureTextEntry />
              {!!message && <Text style={styles.message}>{message}</Text>}
              <TouchableOpacity style={styles.primaryButton} onPress={submitAuth} disabled={busy || !email || password.length < 8}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{authMode === 'login' ? 'Entrar' : 'Criar conta'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setAuthMode(authMode === 'login' ? 'cadastro' : 'login'); setMessage('') }}>
                <Text style={styles.switchAuth}>{authMode === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Entre'}</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.siteButton} onPress={() => Linking.openURL(`${SITE_URL}/perfil.html`)}><Text style={styles.siteButtonText}>Abrir perfil e pedidos no site</Text></TouchableOpacity>
        </ScrollView>
      )}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.tab} onPress={() => setScreen('catalog')}><Text style={[styles.tabText, screen === 'catalog' && styles.tabActive]}>⌂  Catálogo</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setScreen('account')}><Text style={[styles.tabText, screen === 'account' && styles.tabActive]}>◉  Conta</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => Linking.openURL(SITE_URL)}><Text style={styles.tabText}>↗  Site</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f6f2' },
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#eae5df' },
  brand: { color: '#252321', fontSize: 23, fontWeight: '900', letterSpacing: 1.4 },
  brandAccent: { color: BRAND },
  tagline: { color: '#77716a', fontSize: 11, marginTop: 1 },
  accountButton: { borderColor: BRAND, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  accountButtonText: { color: BRAND, fontSize: 13, fontWeight: '700' },
  catalogContent: { paddingHorizontal: 16, paddingBottom: 18 },
  intro: { paddingVertical: 22 },
  eyebrow: { color: BRAND, fontSize: 11, letterSpacing: 1.8, fontWeight: '800', marginBottom: 8 },
  title: { color: '#252321', fontSize: 27, lineHeight: 33, fontWeight: '800' },
  subtitle: { color: '#77716a', fontSize: 14, lineHeight: 21, marginTop: 8 },
  row: { justifyContent: 'space-between', gap: 12 },
  card: { flex: 1, marginBottom: 14, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#eee9e3' },
  productImage: { width: '100%', height: 142, backgroundColor: '#f0ede8' },
  cardBody: { padding: 11 },
  category: { color: BRAND, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '800' },
  productName: { color: '#292725', fontSize: 13, lineHeight: 18, fontWeight: '700', minHeight: 36, marginTop: 5 },
  price: { color: '#252321', fontSize: 15, fontWeight: '800', marginVertical: 10 },
  outlineButton: { borderColor: '#ded8d0', borderWidth: 1, borderRadius: 8, padding: 9, alignItems: 'center' },
  outlineButtonText: { color: '#423d38', fontSize: 11, fontWeight: '700' },
  siteButton: { backgroundColor: '#fff', padding: 15, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#ded8d0', marginTop: 12 },
  siteButtonText: { color: BRAND, fontWeight: '700' },
  accountContent: { padding: 22, flexGrow: 1 },
  authCard: { backgroundColor: '#fff', padding: 18, borderRadius: 14, marginTop: 22, borderWidth: 1, borderColor: '#eee9e3' },
  input: { borderWidth: 1, borderColor: '#ded8d0', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12, fontSize: 15, color: '#252321' },
  primaryButton: { backgroundColor: BRAND, padding: 14, borderRadius: 9, alignItems: 'center', marginTop: 3 },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  switchAuth: { textAlign: 'center', color: BRAND, fontWeight: '700', marginTop: 18, padding: 4 },
  message: { color: BRAND, fontSize: 13, marginBottom: 12 },
  accountEmail: { color: '#4e4944', fontSize: 15, marginBottom: 18 },
  bottomBar: { height: 61, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eae5df', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  tab: { flex: 1, alignItems: 'center', padding: 12 },
  tabText: { color: '#77716a', fontSize: 12, fontWeight: '600' },
  tabActive: { color: BRAND, fontWeight: '800' },
})
