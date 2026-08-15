from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from news.models import Article, Author, Category, Quote

NAV_CATEGORIES = [
    'Politics', 'U.S.', 'World', 'Business', 'Technology',
    'Science', 'Health', 'Sports', 'Entertainment',
]
MORE_CATEGORIES = [
    'Opinion', 'Climate', 'Education', 'Real Estate',
    'Travel', 'Obituaries', 'Weather', 'Investigations',
]

AUTHORS = ['Sarah Whitfield', 'Marcus Delaney', 'Priya Nair', 'Tom Callahan']

# (title, dek, category, minutes_ago, view_count, flags)
ARTICLES = [
    ('Congress Reaches Deal on Infrastructure Funding After Marathon Session',
     'Lawmakers from both parties struck a last-minute compromise early this morning, clearing the way for a $40 billion package.',
     'Politics', 18, 812, dict(is_breaking=True)),
    ('Fed Signals Possible Rate Pause as Inflation Cools',
     'Officials pointed to three straight months of easing price growth as justification for a more cautious stance.',
     'Business', 42, 640, dict()),
    ('Coastal Cities Brace for Record Storm Surge This Weekend',
     'Emergency crews are pre-positioning supplies along the Eastern Seaboard as the storm strengthens offshore.', 'U.S.', 55, 511, dict()),
    ('Start-Up Unveils Battery That Charges in Under Five Minutes',
     'The California company says its new cell chemistry could reshape how electric vehicles are built and sold.',
     'Technology', 70, 933, dict(is_exclusive=True)),
    ('European Leaders Meet in Brussels to Discuss Energy Security',
     'The summit comes as several member states report record winter demand and thinning gas reserves.',
     'World', 95, 402, dict()),
    ('City Council Approves Long-Delayed Transit Expansion',
     'The plan adds twelve miles of light rail and is expected to break ground next spring.', 'U.S.', 130, 298, dict()),
    ('Senate Committee Advances Bipartisan Data Privacy Bill',
     'The measure would give consumers new rights to access and delete personal data held by tech firms.',
     'Politics', 160, 355, dict()),
    ('Manufacturing Orders Rise for a Third Straight Month',
     'Economists say the gain suggests resilience in the sector despite higher borrowing costs.', 'Business', 190, 210, dict()),
    ('Researchers Report Breakthrough in Early Cancer Detection',
     'A new blood test identified early-stage tumors with significantly higher accuracy in trials.',
     'Science', 210, 466, dict(is_editors_pick=True)),
    ('Underdog Run Continues as City Clinches Conference Title',
     'A last-minute goal sealed the win in front of a sold-out home crowd.', 'Sports', 240, 389, dict()),
    ('Streaming Giant Announces Password-Sharing Crackdown Timeline',
     'The company says the change will roll out to all markets by early next year.',
     'Entertainment', 260, 301, dict()),
    ('Regional Airline Adds Six New Domestic Routes for Summer',
     'The expansion targets smaller metro areas that lost service during the pandemic.', 'Travel', 300, 150, dict()),
    ('Investigation: How a Small Town Water System Failed Its Residents',
     'A months-long review found years of deferred maintenance and missed state inspections.',
     'Investigations', 320, 588, dict(is_exclusive=True, is_editors_pick=True)),
    ('Wildfire Smoke Prompts Air Quality Warnings Across the Midwest',
     'Health officials are urging residents to limit outdoor activity through the end of the week.',
     'Health', 340, 275, dict()),
    ('School Districts Weigh Four-Day Week Amid Budget Pressures',
     'Several districts say the schedule change could save millions without cutting staff.',
     'Education', 360, 198, dict()),
    ('Homebuilders Report Fewer Permits as Mortgage Rates Bite',
     'New construction starts fell for the second consecutive quarter, an industry group said Tuesday.',
     'Real Estate', 380, 176, dict()),
    ('Coach Breaks Down the Play That Decided the Championship',
     'Video: the winning drive, explained frame by frame by the team’s offensive coordinator.',
     'Sports', 400, 421, dict(youtube_id='dQw4w9WgXcQ')),
    ('Inside the Lab Racing to Build a Better Grid Battery',
     'Video: a look at the storage technology researchers hope will stabilize renewable power.',
     'Technology', 420, 340, dict(youtube_id='dQw4w9WgXcQ')),
    ('What This Week’s Jobs Report Really Tells Us',
     'Video: our economics team unpacks the numbers behind the headline.',
     'Business', 440, 287, dict(youtube_id='dQw4w9WgXcQ')),
    ('Opinion: The Infrastructure Deal Doesn’t Go Far Enough',
     'A columnist argues the compromise trades long-term resilience for short-term political wins.',
     'Opinion', 460, 233, dict()),
]

# (name, title, quote_text, source, days_ago, related_article_title_or_None)
QUOTES = [
    ('Elena Martins', 'Secretary of Energy',
     'We are very encouraged by the pace of the negotiations. This agreement reflects a genuine commitment '
     'from both sides to modernize the grid without leaving communities behind.',
     'Press briefing following the Brussels energy summit', 0,
     'European Leaders Meet in Brussels to Discuss Energy Security'),
    ('Governor Daniel Reyes', 'Governor',
     'Our emergency teams have been preparing for this storm since Monday. We are asking every resident in '
     'the evacuation zone to take this seriously and leave while there is still time.',
     'Statement to reporters', 1,
     'Coastal Cities Brace for Record Storm Surge This Weekend'),
]


class Command(BaseCommand):
    help = 'Populates the database with demo content so the homepage can be reviewed locally.'

    def handle(self, *args, **options):
        authors = [
            Author.objects.get_or_create(slug=slugify(name), defaults={'name': name})[0]
            for name in AUTHORS
        ]

        categories = {}
        for i, name in enumerate(NAV_CATEGORIES + MORE_CATEGORIES):
            categories[name], _ = Category.objects.get_or_create(
                slug=slugify(name), defaults={'name': name, 'order': i}
            )

        now = timezone.now()
        for i, (title, dek, cat_name, minutes_ago, views, flags) in enumerate(ARTICLES):
            Article.objects.update_or_create(
                slug=slugify(title)[:255],
                defaults=dict(
                    title=title,
                    dek=dek,
                    body=f'<p>{dek}</p><p>Full reporting continues below the fold.</p>',
                    category=categories[cat_name],
                    author=authors[i % len(authors)],
                    status=Article.Status.PUBLISHED,
                    published_at=now - timedelta(minutes=minutes_ago),
                    view_count=views,
                    **flags,
                ),
            )

        for name, title, quote_text, source, days_ago, article_title in QUOTES:
            related = Article.objects.filter(title=article_title).first() if article_title else None
            Quote.objects.update_or_create(
                name=name,
                quote_text=quote_text,
                defaults=dict(
                    title=title,
                    source=source,
                    quote_date=(now - timedelta(days=days_ago)).date(),
                    related_article=related,
                    is_active=True,
                ),
            )

        self.stdout.write(self.style.SUCCESS(
            f'Seeded {len(categories)} categories, {len(ARTICLES)} articles and {len(QUOTES)} quotes.'
        ))
