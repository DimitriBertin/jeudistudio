const fragmentShaderVelocity = `
  uniform float time;
  uniform float testing;
  uniform float delta; // about 0.016
  uniform float separationDistance; // 20
  uniform float alignmentDistance; // 40
  uniform float cohesionDistance; //
  uniform float freedomFactor;
  uniform vec3 predator;

  const float width = resolution.x;
  const float height = resolution.y;

  const float PI = 3.141592653589793;
  const float PI_2 = PI * 2.0;
  // const float VISION = PI * 0.55;

  float zoneRadius = 40.0;
  float zoneRadiusSquared = 1600.0;

  float separationThresh = 0.45;
  float alignmentThresh = 0.65;

  const float UPPER_BOUNDS = BOUNDS;
  const float LOWER_BOUNDS = -UPPER_BOUNDS;

  const float SPEED_LIMIT = 9.0;

  float rand( vec2 co ){
    return fract( sin( dot( co.xy, vec2(12.9898,78.233) ) ) * 43758.5453 );
  }

  void main() {
    zoneRadius = separationDistance + alignmentDistance + cohesionDistance;
    separationThresh = separationDistance / zoneRadius;
    alignmentThresh = ( separationDistance + alignmentDistance ) / zoneRadius;
    zoneRadiusSquared = zoneRadius * zoneRadius;


    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 birdPosition, birdVelocity;

    vec3 selfPosition = texture2D( texturePosition, uv ).xyz;
    vec3 selfVelocity = texture2D( textureVelocity, uv ).xyz;

    float dist;
    vec3 dir; // direction
    float distSquared;

    float separationSquared = separationDistance * separationDistance;
    float cohesionSquared = cohesionDistance * cohesionDistance;

    float f;
    float percent;

    vec3 velocity = selfVelocity;

    float limit = SPEED_LIMIT;

    // Obtenir la position de la souris comme point d'attraction
    vec3 mousePosition = predator * UPPER_BOUNDS;
    
    // Les oiseaux sont attirés par la souris au lieu de la fuir
    dir = mousePosition - selfPosition;
    dir.z = 0.; // Garder les oiseaux sur le même plan Z que la souris
    dist = length(dir);
    
    float attractRadius = 600.0; // Rayon d'influence de la souris
    
    // Si les oiseaux sont dans le rayon d'attraction de la souris
    if (dist < attractRadius && dist > 0.0) {
      // Force d'attraction inversement proportionnelle à la distance
      f = (1.0 - dist/attractRadius) * delta * 15.0;
      velocity += normalize(dir) * f;
      limit += 2.0; // Augmenter légèrement la limite de vitesse
    }
    
    // Attraction secondaire vers un point en hauteur
    // (conserver cette attraction comme comportement par défaut quand la souris est loin)
    vec3 central = vec3(0., 200., 0.);
    dir = central - selfPosition;
    dist = length(dir);
    
    // Force d'attraction réduite vers le centre pour donner priorité à la souris
    velocity += normalize(dir) * delta * 1.0;

    for (float y = 0.0; y < height; y++) {
      for (float x = 0.0; x < width; x++) {

        vec2 ref = vec2(x + 0.5, y + 0.5) / resolution.xy;
        birdPosition = texture2D(texturePosition, ref).xyz;

        dir = birdPosition - selfPosition;
        dist = length(dir);

        if (dist < 0.0001) continue;

        distSquared = dist * dist;

        if (distSquared > zoneRadiusSquared) continue;

        percent = distSquared / zoneRadiusSquared;

        if (percent < separationThresh) { // low

          // Separation - Move apart for comfort
          f = (separationThresh / percent - 1.0) * delta;
          velocity -= normalize(dir) * f;

        } else if (percent < alignmentThresh) { // high

          // Alignment - fly the same direction
          float threshDelta = alignmentThresh - separationThresh;
          float adjustedPercent = (percent - separationThresh) / threshDelta;

          birdVelocity = texture2D(textureVelocity, ref).xyz;

          f = (0.5 - cos(adjustedPercent * PI_2) * 0.5 + 0.5) * delta;
          velocity += normalize(birdVelocity) * f;

        } else {

          // Attraction / Cohesion - move closer
          float threshDelta = 1.0 - alignmentThresh;
          float adjustedPercent;
          if (threshDelta == 0.) adjustedPercent = 1.;
          else adjustedPercent = (percent - alignmentThresh) / threshDelta;

          f = (0.5 - (cos(adjustedPercent * PI_2) * -0.5 + 0.5)) * delta;

          velocity += normalize(dir) * f;
        }
      }
    }

    // Speed Limits
    if (length(velocity) > limit) {
      velocity = normalize(velocity) * limit;
    }

    gl_FragColor = vec4(velocity, 1.0);
  }
`;
export default fragmentShaderVelocity;