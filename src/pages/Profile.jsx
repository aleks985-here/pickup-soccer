import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'

const CROP_SIZE = 260

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null) // {msg, type}
  const [isLinked, setIsLinked] = useState(false)
  const [linkedId, setLinkedId] = useState(null)
  const [pendingStatus, setPendingStatus] = useState(null)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [city, setCity] = useState('')
  const [foot, setFoot] = useState('')
  const [pos1, setPos1] = useState(null)
  const [pos2, setPos2] = useState(null)
  const [yearsPlayed, setYearsPlayed] = useState('')
  const [league, setLeague] = useState('')
  const [notes, setNotes] = useState('')
  const [suggestedPlayerId, setSuggestedPlayerId] = useState('')
  const [primaryGroupId, setPrimaryGroupId] = useState('')
  const [isUnder13, setIsUnder13] = useState(false)

  // Roster & groups
  const [roster, setRoster] = useState([])
  const [groups, setGroups] = useState([])

  // Photo
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)

  // Crop modal
  const [cropOpen, setCropOpen] = useState(false)
  const [cropZoom, setCropZoom] = useState(1)
  const cropImgRef = useRef(null)
  const cropCanvasRef = useRef(null)
  const cropOffRef = useRef({ x: 0, y: 0 })
  const cropScaleRef = useRef(1)
  const cropInitScaleRef = useRef(1)
  const dragStartRef = useRef(null)
  const dragOffStartRef = useRef(null)

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  // Draw crop after modal opens
  useEffect(() => {
    if (cropOpen) setTimeout(drawCrop, 0)
  }, [cropOpen])

  async function loadData() {
    const [{ data: rosterData }, { data: groupsData }] = await Promise.all([
      sb.from('players').select('id,name').order('name'),
      sb.from('groups').select('id,slug,name').order('name'),
    ])
    setRoster(rosterData || [])
    setGroups(groupsData || [])

    const { data: linked } = await sb.from('players').select('*').eq('auth_user_id', user.id).maybeSingle()
    if (linked) {
      setIsLinked(true)
      setLinkedId(linked.id)
      prefillForm(linked)
      if (linked.primary_group_id) setPrimaryGroupId(linked.primary_group_id)
      setAlert({ msg: '✓ Your profile is approved and you are on the roster.', type: 'green' })
      return
    }

    const { data: pending } = await sb.from('pending_profiles').select('*').eq('auth_user_id', user.id).maybeSingle()
    if (pending) {
      prefillForm(pending)
      if (pending.suggested_player_id) setSuggestedPlayerId(pending.suggested_player_id)
      if (pending.status === 'pending') {
        setPendingStatus('pending')
        setAlert({ msg: '⏳ Your profile is under review. A captain will approve it shortly.', type: 'green' })
      } else if (pending.status === 'rejected') {
        setPendingStatus('rejected')
        setAlert({ msg: '⚠ Your profile was not approved. Reason: ' + (pending.rejection_reason || 'Contact a captain.'), type: 'red' })
      }
    }
  }

  function prefillForm(d) {
    if (d.first_name) setFirstName(d.first_name)
    if (d.last_name) setLastName(d.last_name)
    if (d.date_of_birth) { setDob(d.date_of_birth); checkAgeValue(d.date_of_birth) }
    if (d.city) setCity(d.city)
    if (d.dominant_foot) setFoot(d.dominant_foot)
    if (d.years_played) setYearsPlayed(d.years_played)
    if (d.league_experience) setLeague(d.league_experience)
    if (d.player_notes) setNotes(d.player_notes)
    if (d.positions?.[0]) setPos1(d.positions[0])
    if (d.positions?.[1]) setPos2(d.positions[1])
    if (d.photo_url) setPhotoPreviewUrl(d.photo_url)
  }

  function checkAgeValue(val) {
    if (!val) { setIsUnder13(false); return }
    const today = new Date(), birth = new Date(val)
    const age = today.getFullYear() - birth.getFullYear() -
      (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
    setIsUnder13(age < 13)
  }

  // ---- Photo crop ----
  function onPhotoInput(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setAlert({ msg: 'Photo too large. Max 5MB.', type: 'red' }); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const initScale = CROP_SIZE / Math.min(img.width, img.height)
      cropImgRef.current = img
      cropInitScaleRef.current = initScale
      cropScaleRef.current = initScale
      cropOffRef.current = {
        x: (CROP_SIZE - img.width * initScale) / 2,
        y: (CROP_SIZE - img.height * initScale) / 2,
      }
      setCropZoom(initScale)
      setCropOpen(true)
    }
    img.src = url
  }

  function drawCrop() {
    const canvas = cropCanvasRef.current
    if (!canvas || !cropImgRef.current) return
    const ctx = canvas.getContext('2d')
    const img = cropImgRef.current
    const { x, y } = cropOffRef.current
    const scale = cropScaleRef.current
    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE)
    ctx.save()
    ctx.beginPath()
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
    ctx.restore()
    ctx.strokeStyle = '#2d5509'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2 - 1, 0, Math.PI * 2)
    ctx.stroke()
  }

  function applyZoom(val) {
    const scale = parseFloat(val)
    const img = cropImgRef.current
    cropScaleRef.current = scale
    cropOffRef.current = {
      x: CROP_SIZE / 2 - (img.width * scale) / 2,
      y: CROP_SIZE / 2 - (img.height * scale) / 2,
    }
    setCropZoom(scale)
    drawCrop()
  }

  function zoomStep(delta) {
    const init = cropInitScaleRef.current
    const next = Math.max(init * 0.5, Math.min(init * 5, cropScaleRef.current + delta * init))
    applyZoom(next)
  }

  function onCropDragStart(clientX, clientY) {
    dragStartRef.current = { x: clientX, y: clientY }
    dragOffStartRef.current = { ...cropOffRef.current }
  }
  function onCropDragMove(clientX, clientY) {
    if (!dragStartRef.current) return
    cropOffRef.current = {
      x: dragOffStartRef.current.x + (clientX - dragStartRef.current.x),
      y: dragOffStartRef.current.y + (clientY - dragStartRef.current.y),
    }
    drawCrop()
  }

  function confirmCrop() {
    cropCanvasRef.current.toBlob(blob => {
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      setPhotoFile(file)
      setPhotoPreviewUrl(URL.createObjectURL(blob))
      setCropOpen(false)
    }, 'image/jpeg', 0.88)
  }

  // ---- Save ----
  async function saveProfile() {
    const missing = []
    if (!firstName.trim()) missing.push('First name')
    if (!lastName.trim()) missing.push('Last name')
    if (!dob) missing.push('Date of birth')
    if (isUnder13) { setAlert({ msg: 'You must be at least 13 to register.', type: 'red' }); return }
    if (!city.trim()) missing.push('City / Town')
    if (!foot) missing.push('Dominant foot')
    if (!pos1) missing.push('Primary position')
    if (!yearsPlayed) missing.push('Years playing soccer')
    if (!league) missing.push('League experience')
    if (missing.length > 0) {
      setAlert({ msg: 'Please complete all required fields: ' + missing.join(', '), type: 'red' })
      window.scrollTo(0, 0)
      return
    }

    setSaving(true)

    let photoUrl = null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const { error: upErr } = await sb.storage.from('avatars').upload(`avatars/${user.id}.${ext}`, photoFile, { upsert: true })
      if (!upErr) {
        const { data: urlData } = sb.storage.from('avatars').getPublicUrl(`avatars/${user.id}.${ext}`)
        photoUrl = urlData.publicUrl
      }
    }

    const today = new Date(), birth = new Date(dob)
    const age = today.getFullYear() - birth.getFullYear() -
      (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
    const positions = pos2 && pos2 !== 'none' ? [pos1, pos2] : [pos1]

    if (isLinked) {
      const { error } = await sb.from('players').update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim().charAt(0)}.`,
        date_of_birth: dob,
        is_minor: age < 18,
        city: city.trim(),
        dominant_foot: foot,
        positions,
        years_played: yearsPlayed,
        league_experience: league,
        player_notes: notes.trim() || null,
        primary_group_id: primaryGroupId || null,
        ...(photoUrl ? { photo_url: photoUrl } : {}),
      }).eq('id', linkedId)
      setSaving(false)
      if (error) { setAlert({ msg: 'Error: ' + error.message, type: 'red' }); return }
      setAlert({ msg: '✓ Profile updated!', type: 'green' })
      setTimeout(() => navigate('/'), 1500)
      return
    }

    const sugName = suggestedPlayerId ? roster.find(p => p.id === suggestedPlayerId)?.name : null
    const payload = {
      auth_user_id: user.id,
      email: user.email,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dob,
      is_minor: age < 18,
      city: city.trim(),
      dominant_foot: foot,
      positions,
      years_played: yearsPlayed,
      league_experience: league,
      player_notes: notes.trim() || null,
      suggested_player_id: suggestedPlayerId || null,
      suggested_player_name: sugName || null,
      status: 'pending',
      ...(photoUrl ? { photo_url: photoUrl } : {}),
    }

    const { error } = await sb.from('pending_profiles').upsert(payload, { onConflict: 'auth_user_id' })
    setSaving(false)
    if (error) { setAlert({ msg: 'Error: ' + error.message, type: 'red' }); return }
    setAlert({ msg: '✓ Profile submitted! A captain will review your request and add you to the roster.', type: 'green' })
    setPendingStatus('pending')
    window.scrollTo(0, 0)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>Loading…</div>
  )

  if (!user) return (
    <div style={{ maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#2d5509', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>⚽ Pickup Soccer</h1>
        <a onClick={() => navigate('/')} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}>← Back to app</a>
      </div>
      <div style={{ textAlign: 'center', padding: '60px 20px', fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ fontSize: 20, marginBottom: 10 }}>Sign in to set up your profile</h2>
        <p style={{ color: '#666', marginBottom: 20, fontSize: 14 }}>Create an account or sign in to save your player profile.</p>
        <button onClick={() => navigate('/')} style={{ background: '#2d5509', color: '#fff', padding: '12px 28px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Go to app → sign in</button>
      </div>
    </div>
  )

  const init = cropInitScaleRef.current

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 90, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f5f5f0', minHeight: '100vh', color: '#1a1a1a' }}>
      {/* Header */}
      <div style={{ background: '#2d5509', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>⚽ Pickup Soccer</h1>
        <span onClick={() => navigate(-1)} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, cursor: 'pointer' }}>← Back</span>
      </div>

      {/* Step indicator */}
      {!isLinked && (
        <div style={{ display: 'flex', gap: 6, padding: '12px 16px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i === 0 ? '#2d5509' : i === 1 ? '#a8d87a' : '#e0e0e0' }} />
          ))}
        </div>
      )}

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          {isLinked ? 'Edit your profile' : pendingStatus === 'pending' ? 'Profile submitted' : 'Your player profile'}
        </div>
        <div style={{ fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
          {isLinked
            ? 'Your profile is active. Keep your details up to date.'
            : pendingStatus === 'pending'
            ? 'Waiting for a captain to approve your request. You can update your details below.'
            : 'Fill this out so captains can build fair teams. Your skill rating is set by captains — it won\'t be shown to you.'}
        </div>

        {alert && (
          <div style={{
            padding: '12px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14,
            background: alert.type === 'green' ? '#eaf5e0' : '#fff5f5',
            color: alert.type === 'green' ? '#2a5c0e' : '#c0392b',
            border: `1px solid ${alert.type === 'green' ? '#a8d87a' : '#f5c6c6'}`,
            lineHeight: 1.6,
          }}>{alert.msg}</div>
        )}

        {/* PHOTO */}
        <PCard title="Photo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0, overflow: 'hidden' }}>
              {photoPreviewUrl
                ? <img src={photoPreviewUrl} alt="photo" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
                : '👤'}
            </div>
            <div>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 8, lineHeight: 1.4 }}>Optional — helps captains recognize you</p>
              <label style={{ display: 'inline-block', padding: '8px 16px', border: '1px solid #ccc', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff', color: '#555' }}>
                📷 Choose photo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhotoInput} />
              </label>
            </div>
          </div>
        </PCard>

        {/* PERSONAL INFO */}
        <PCard title="Personal info">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <PField label="First name" required>
              <PInput value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Alex" autoComplete="given-name" />
            </PField>
            <PField label="Last name" required>
              <PInput value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" autoComplete="family-name" />
            </PField>
          </div>
          <PField label="Date of birth" required>
            <PInput type="date" value={dob} max={new Date().toISOString().split('T')[0]}
              onChange={e => { setDob(e.target.value); checkAgeValue(e.target.value) }} />
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Required for age verification. Not shown publicly.</div>
            {isUnder13 && <div style={{ background: '#fff5f5', border: '1px solid #f5c6c6', borderRadius: 8, padding: 12, marginTop: 8, fontSize: 13, color: '#c0392b', lineHeight: 1.5 }}>
              You must be at least 13 years old to create an account.
            </div>}
          </PField>
          <PField label="City / Town">
            <PInput value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Westwood, MA" autoComplete="address-level2" />
          </PField>
        </PCard>

        {/* PLAYING PROFILE */}
        <PCard title="Playing profile">
          <PField label="Dominant foot" required>
            <PSelect value={foot} onChange={e => setFoot(e.target.value)}>
              <option value="">Select…</option>
              <option value="Right">Right</option>
              <option value="Left">Left</option>
              <option value="Both">Both (comfortable either side)</option>
            </PSelect>
          </PField>
          <PField label="Primary position" required>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['GK', 'DEF', 'MID', 'FWD'].map(p => (
                <button key={p} type="button" className={`pos-btn${pos1 === p ? ' sel-' + p : ''}`}
                  onClick={() => setPos1(p)}>{p}</button>
              ))}
            </div>
          </PField>
          <PField label="Secondary position">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['GK', 'DEF', 'MID', 'FWD'].map(p => (
                <button key={p} type="button" className={`pos-btn${pos2 === p ? ' sel-' + p : ''}`}
                  onClick={() => setPos2(p === pos2 ? null : p)}>{p}</button>
              ))}
              <button type="button" className={`pos-btn${!pos2 ? ' sel-none' : ''}`}
                style={{ color: '#aaa', background: '#f9f9f9' }}
                onClick={() => setPos2(null)}>None</button>
            </div>
          </PField>
          <PField label="Years playing soccer" required>
            <PSelect value={yearsPlayed} onChange={e => setYearsPlayed(e.target.value)}>
              <option value="">Select…</option>
              <option value="0-1">Less than 1 year</option>
              <option value="1-3">1 to 3 years</option>
              <option value="3-5">3 to 5 years</option>
              <option value="5-10">5 to 10 years</option>
              <option value="10+">10+ years</option>
            </PSelect>
          </PField>
          <PField label="League experience" required>
            <PSelect value={league} onChange={e => setLeague(e.target.value)}>
              <option value="">Select…</option>
              <option value="Never">Never played in a league</option>
              <option value="Recreational">Recreational / social league</option>
              <option value="Amateur">Amateur competitive league</option>
              <option value="Semi-pro">Semi-professional</option>
              <option value="Pro">Professional</option>
            </PSelect>
          </PField>
        </PCard>

        {/* PRIMARY LOCATION */}
        <PCard title="Primary playing location">
          <PField label="Where do you usually play?">
            <PSelect value={primaryGroupId} onChange={e => setPrimaryGroupId(e.target.value)}>
              <option value="">Select a group…</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </PSelect>
          </PField>
        </PCard>

        {/* ROSTER MATCH */}
        {!isLinked && (
          <PCard title="Are you already in the roster?">
            <p style={{ fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
              If you've played with this group before, select your name from the list. A captain will verify and link your account.
            </p>
            <PField label="Your name in the roster">
              <PSelect value={suggestedPlayerId} onChange={e => setSuggestedPlayerId(e.target.value)}>
                <option value="">I'm not in the roster yet / not sure</option>
                {roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </PSelect>
            </PField>
          </PCard>
        )}

        {/* NOTES */}
        <PCard title="Notes for captains">
          <PField label="Anything captains should know?">
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8, fontSize: 14, height: 80, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#1a1a1a' }}
              placeholder="e.g. recovering from knee surgery, prefer not to play GK, have played for Westwood FC for 3 years…" />
          </PField>
        </PCard>

        <p style={{ fontSize: 12, color: '#999', padding: '0 4px 20px', textAlign: 'center', lineHeight: 1.5 }}>
          Your skill rating is set by a captain — it's private and won't be shown to you.{' '}
          <a href="/privacy" style={{ color: '#2d5509' }}>Privacy policy</a>
        </p>
      </div>

      {/* Fixed save bar */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 560, background: '#fff', borderTop: '1px solid #e0e0e0', padding: '12px 16px', zIndex: 100 }}>
        <button onClick={saveProfile} disabled={saving || isUnder13}
          style={{ width: '100%', padding: 13, borderRadius: 8, border: 'none', fontSize: 15, fontWeight: 600, cursor: saving || isUnder13 ? 'not-allowed' : 'pointer', background: '#2d5509', color: '#fff', opacity: saving || isUnder13 ? 0.5 : 1 }}>
          {saving ? 'Saving…' : isLinked ? 'Save changes →' : pendingStatus === 'pending' ? 'Update profile →' : 'Save profile →'}
        </button>
      </div>

      {/* Crop modal */}
      {cropOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, maxWidth: 340, width: '100%' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, textAlign: 'center', margin: '0 0 14px' }}>Adjust your photo</h3>
            <div
              style={{ width: CROP_SIZE, height: CROP_SIZE, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 14px', border: '3px solid #2d5509', cursor: 'grab', position: 'relative', touchAction: 'none', display: 'block' }}
              onMouseDown={e => onCropDragStart(e.clientX, e.clientY)}
              onMouseMove={e => onCropDragMove(e.clientX, e.clientY)}
              onMouseUp={() => { dragStartRef.current = null }}
              onMouseLeave={() => { dragStartRef.current = null }}
              onTouchStart={e => { onCropDragStart(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault() }}
              onTouchMove={e => { onCropDragMove(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault() }}
              onTouchEnd={() => { dragStartRef.current = null }}
            >
              <canvas ref={cropCanvasRef} width={CROP_SIZE} height={CROP_SIZE} style={{ display: 'block' }} />
            </div>
            <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 10 }}>Drag to reposition · Zoom to fit</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button onClick={() => zoomStep(-0.1)} style={{ background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 6, padding: '4px 10px', fontSize: 16, cursor: 'pointer' }}>−</button>
              <input type="range" min={init * 0.5} max={init * 5} step={0.02} value={cropZoom}
                onChange={e => applyZoom(e.target.value)}
                style={{ flex: 1, accentColor: '#2d5509' }} />
              <button onClick={() => zoomStep(0.1)} style={{ background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 6, padding: '4px 10px', fontSize: 16, cursor: 'pointer' }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCropOpen(false)} style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#f0f0f0', color: '#444' }}>Cancel</button>
              <button onClick={confirmCrop} style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#2d5509', color: '#fff' }}>Use this photo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PCard({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#2d5509', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function PField({ label, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 4, fontWeight: 500 }}>
        {label}{required && <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function PInput({ ...props }) {
  return (
    <input {...props} style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box', ...props.style }} />
  )
}

function PSelect({ children, ...props }) {
  return (
    <select {...props} style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box' }}>
      {children}
    </select>
  )
}
