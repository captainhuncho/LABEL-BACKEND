import { Upload } from 'lucide-react';
import { dealLabel, formatDate } from '../../constants.js';
import { dealTermsOf } from '../../finance.js';
import { SOCIAL_LINKS, PROFILE_EDITABLE_FIELDS } from '../../seed.js';
import { C } from '../../theme.js';
import { Avatar, Badge, Btn, Field, Input, Td, TextArea, PhotoCropper } from '../../ui.jsx';
import { PasskeySettings } from '../../Passkeys.jsx';
import { TwoFactorSettings } from '../../Mfa.jsx';

// The artist portal's profile tab (state lives in ArtistPortalShell).
export function ProfileTab({ artist, cropFile, handleProfilePhoto, monthLong, myPendingRequest, myProfileRequests, paid, pctLabel, profileForm, profileInputRef, profileSaved, saveProfile, setCropFile, setProfileForm, submitProfileRequest }) {
  return (
          <div>
            <PasskeySettings />
            <TwoFactorSettings />
            <section aria-label="Your deal" className="rounded p-5 mb-6" style={{ background: C.panel }}>
              <h2 style={{ fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em' }}>Your deal</h2>
              <p className="mt-1 mb-3" style={{ color: C.textDim, fontSize: 14 }}>Your share of net earnings and your deal over time. Each month is paid at the terms in force that month.</p>
              <ol className="imss-steps" aria-label="Deal history">
                {dealTermsOf(artist).map((t, i, list) => (
                  <li key={i} className={i === list.length - 1 ? 'is-current' : 'is-done'}>
                    <span className="imss-step-dot" aria-hidden="true">{i + 1}</span>
                    <span>{t.from ? 'From ' + monthLong(t.from) : 'Start'} · {pctLabel(t.artistPct)} to you · {dealLabel(t)}</span>
                  </li>
                ))}
              </ol>
            </section>
            <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
              <div className="text-sm" style={{ color: C.textDim }}>
                {saveProfile ? 'Update your photo, bio and links here; they save straight away. Your sign-in email, royalty rate, contract terms and team are managed by the label.' : 'You can update your photo, bio and links here. Changes are reviewed by your Product Manager or Admin before they go live. Everything else on your profile (royalty rate, contract terms, team assignments) is managed by the label directly.'}
              </div>
            </div>

            {myPendingRequest && (
              <div className="rounded border p-4 mb-6" style={{ background: C.amberSoft, borderColor: C.amber }}>
                <div className="text-xs mb-2" style={{ color: C.amber, fontWeight: 600 }}>Awaiting review</div>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(myPendingRequest.changes).map(([key, value]) => {
                    const field = PROFILE_EDITABLE_FIELDS.find(f => f.key === key);
                    return (
                      <div key={key} className="text-sm" style={{ color: C.text }}>
                        {field ? field.label : key}: {key === 'photoUrl' ? 'New photo submitted' : <span style={{ fontStyle: 'italic' }}>"{value}"</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs mt-2" style={{ color: C.textFaint }}>Submitted {new Date(myPendingRequest.submittedAt).toLocaleString()}</div>
              </div>
            )}

            <div className="rounded p-6 mb-6" style={{ background: C.panel }}>
              <h2 style={{ fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em' }}>Edit your profile</h2>
              <p className="mt-1 mb-5" style={{ color: C.textDim, fontSize: 14 }}>{saveProfile ? 'Changes save as soon as you press Save.' : 'Changes go to the label for review before they show.'}</p>

              {cropFile && <PhotoCropper file={cropFile} onDone={url => { setProfileForm(f => ({ ...f, photoUrl: url })); setCropFile(null); if (profileInputRef.current) profileInputRef.current.value = ''; }} onCancel={() => { setCropFile(null); if (profileInputRef.current) profileInputRef.current.value = ''; }} />}
              <section aria-label="Photo" className="flex items-center gap-4 mb-6">
                <Avatar name={artist.name} photoUrl={profileForm.photoUrl} size={72} />
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="inline-flex items-center gap-1.5" style={{ position: 'relative', background: C.fill, color: C.text, borderRadius: 980, padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}>
                    <Upload size={14} /> {profileForm.photoUrl ? 'Change photo' : 'Upload photo'}
                    <input ref={profileInputRef} type="file" accept="image/*" onChange={handleProfilePhoto} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                  </label>
                  {profileForm.photoUrl && <button type="button" onClick={() => setProfileForm(f => ({ ...f, photoUrl: '' }))} style={{ color: C.textDim, fontSize: 14 }}>Remove</button>}
                </div>
              </section>

              <section aria-label="About you" className="mb-6">
                <h3 className="mb-3" style={{ fontWeight: 600, fontSize: 15 }}>About you</h3>
                <div className="imss-form-grid gap-3">
                  <Field label="Sign-in email" full><div title="Only the label can change this" style={{ background: 'transparent', border: '1px dashed ' + C.border, borderRadius: 12, padding: '10px 14px', color: C.textDim, cursor: 'not-allowed', userSelect: 'all' }}>{artist.email || '—'}</div><div style={{ color: C.textDim, fontSize: 13, marginTop: 6 }}>To change your sign-in email, contact your Product Manager.</div></Field>
                  <Field label="Bio" full><TextArea rows={4} value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="A short bio the label can use for press and pitches." /></Field>
                </div>
              </section>

              {[['streaming', 'Streaming profiles'], ['social', 'Socials']].map(([g, title]) => (
                <section key={g} aria-label={title} className="mb-6">
                  <h3 style={{ fontWeight: 600, fontSize: 15 }}>{title}</h3>
                  <p className="mt-0.5 mb-3" style={{ color: C.textDim, fontSize: 13 }}>Paste the full link to each page you have. Leave the rest empty.</p>
                  <div className="gap-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                    {SOCIAL_LINKS.filter(l => l.group === g).map(l => <Field key={l.key} label={l.label}><Input type="url" value={profileForm[l.key] || ''} onChange={e => setProfileForm(f => ({ ...f, [l.key]: e.target.value }))} placeholder={l.hint} /></Field>)}
                  </div>
                </section>
              ))}

              <div className="flex items-center justify-end gap-3 pt-4" style={{ borderTop: '1px solid ' + C.border }}>
                {profileSaved && <span role="status" className="text-sm" style={{ color: /Couldn|No changes/.test(profileSaved) ? C.amber : C.teal }}>{profileSaved}</span>}
                <Btn variant="primary" onClick={submitProfileRequest}>{saveProfile ? 'Save' : 'Submit for review'}</Btn>
              </div>
            </div>

            {myProfileRequests.length > 0 && (
              <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
                <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Request history</div>
                <table className="w-full">
                  <tbody>
                    {myProfileRequests.map(r => (
                      <tr key={r.id}>
                        <Td mono>{formatDate(r.submittedAt.slice(0, 10))}</Td>
                        <Td>{Object.keys(r.changes).map(k => (PROFILE_EDITABLE_FIELDS.find(f => f.key === k) || {}).label || k).join(', ')}</Td>
                        <Td><Badge tone={r.status === 'Approved' ? 'teal' : r.status === 'Rejected' ? 'red' : 'amber'}>{r.status}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
  );
}
