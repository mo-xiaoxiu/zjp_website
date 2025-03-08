import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: '书法小记',
    Svg: require('@site/static/img/练书法.svg').default,
    description: (
      <>

      </>
    ),
  },
  {
    title: '个人思考',
    Svg: require('@site/static/img/我的反思.svg').default,
    description: (
      <>

      </>
    ),
  },
  {
    title: '编程记录',
    Svg: require('@site/static/img/编程.svg').default,
    description: (
      <>

      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
