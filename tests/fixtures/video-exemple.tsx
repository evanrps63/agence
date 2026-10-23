import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

// Composition de test : un carré violet qui grandit, fond clair.
export const duree = 60
export const largeur = 720
export const hauteur = 1280
export const fps = 30

export const Video: React.FC = () => {
  const image = useCurrentFrame()
  const taille = interpolate(image, [0, 60], [120, 420], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: '#f5f4f0', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: taille, height: taille, borderRadius: 24, background: '#7c3aed' }} />
    </AbsoluteFill>
  )
}
